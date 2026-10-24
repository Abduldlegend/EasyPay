import { Transaction } from '../models/transaction.model.js';
import { ApiError } from '../utils/ApiError.js';
import { LEDGER_DIRECTION, TRANSACTION_STATUS } from '../constants/index.js';
import { getWalletForUser, getWalletIdsForUser } from './wallet.service.js';
import { listEntriesForTransaction } from './ledger.service.js';

const WALLET_FIELDS_SHOWN = 'reference type';

const idOf = (value) => String(value?._id ?? value);

/**
 * What a user may see: transactions they started (including failed attempts), plus
 * completed transactions that arrived in one of their wallets. Other people's failed
 * attempts to pay them are not shown, so no one else's failure reasons leak.
 */
function visibleTo(userId, walletIds) {
  return {
    $or: [
      { initiatedBy: userId },
      { destination: { $in: walletIds }, status: TRANSACTION_STATUS.COMPLETED },
    ],
  };
}

/** Adds `direction` from the viewer's point of view: money in (credit) or out (debit). */
export function presentTransaction(transaction, walletIds) {
  const ownIds = new Set(walletIds.map(String));
  return {
    ...transaction.toJSON(),
    direction: ownIds.has(idOf(transaction.destination))
      ? LEDGER_DIRECTION.CREDIT
      : LEDGER_DIRECTION.DEBIT,
  };
}

export async function listTransactionsForUser(userId, { page, limit, walletId, type, status, from, to }) {
  const walletIds = await getWalletIdsForUser(userId);
  const conditions = [visibleTo(userId, walletIds)];

  if (walletId) {
    await getWalletForUser(walletId, userId); // 404 unless the wallet is theirs
    conditions.push({ $or: [{ source: walletId }, { destination: walletId }] });
  }
  if (type) conditions.push({ type });
  if (status) conditions.push({ status });
  if (from || to) {
    conditions.push({
      createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) },
    });
  }

  const filter = { $and: conditions };

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('source destination', WALLET_FIELDS_SHOWN),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions: transactions.map((transaction) => presentTransaction(transaction, walletIds)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTransactionForUser(userId, reference) {
  const walletIds = await getWalletIdsForUser(userId);

  const transaction = await Transaction.findOne({
    $and: [{ reference }, visibleTo(userId, walletIds)],
  }).populate('source destination', WALLET_FIELDS_SHOWN);
  if (!transaction) throw ApiError.notFound('Transaction not found');

  // Only the viewer's own ledger entries: the other party's balances stay private.
  const ledgerEntries = await listEntriesForTransaction(transaction._id, walletIds);

  return { transaction: presentTransaction(transaction, walletIds), ledgerEntries };
}
