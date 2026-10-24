import { Wallet } from '../models/wallet.model.js';
import { LedgerEntry } from '../models/ledgerEntry.model.js';
import { ApiError } from '../utils/ApiError.js';
import { LEDGER_DIRECTION, WALLET_STATUS, WALLET_TYPE } from '../constants/index.js';
import { getWalletForUser } from './wallet.service.js';

async function explainRejectedMovement(walletId, session) {
  const wallet = await Wallet.findById(walletId).session(session);
  if (!wallet) return ApiError.notFound('Wallet not found');
  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    return ApiError.unprocessable(`Wallet is ${wallet.status}`);
  }
  return ApiError.unprocessable('Insufficient balance');
}

/**
 * The only place balances change. Updates the wallet balance atomically and writes the
 * matching ledger entry in the same MongoDB transaction (session), so one never exists
 * without the other.
 *
 * Debits on user wallets are conditional on `balance >= amount` inside the database
 * update itself, so two simultaneous withdrawals can never overdraw a wallet.
 */
export async function postMovement({ transactionId, walletId, direction, amount }, session) {
  const isDebit = direction === LEDGER_DIRECTION.DEBIT;

  const filter = { _id: walletId, status: WALLET_STATUS.ACTIVE };
  if (isDebit) {
    filter.$or = [{ type: WALLET_TYPE.SYSTEM }, { balance: { $gte: amount } }];
  }

  const wallet = await Wallet.findOneAndUpdate(
    filter,
    { $inc: { balance: isDebit ? -amount : amount } },
    { returnDocument: 'after', session }
  );
  if (!wallet) throw await explainRejectedMovement(walletId, session);

  const balanceAfter = wallet.balance;
  const balanceBefore = isDebit ? balanceAfter + amount : balanceAfter - amount;

  const [entry] = await LedgerEntry.create(
    [
      {
        transaction: transactionId,
        wallet: wallet._id,
        direction,
        amount,
        currency: wallet.currency,
        balanceBefore,
        balanceAfter,
      },
    ],
    { session }
  );
  return entry;
}

export async function listLedgerForWallet(walletId, ownerId, { page, limit }) {
  await getWalletForUser(walletId, ownerId); // ownership check

  const [entries, total] = await Promise.all([
    LedgerEntry.find({ wallet: walletId })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LedgerEntry.countDocuments({ wallet: walletId }),
  ]);

  return { entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/** Ledger entries for one transaction, limited to the given wallets (the caller's own). */
export function listEntriesForTransaction(transactionId, walletIds) {
  return LedgerEntry.find({ transaction: transactionId, wallet: { $in: walletIds } }).sort({
    createdAt: 1,
    _id: 1,
  });
}
