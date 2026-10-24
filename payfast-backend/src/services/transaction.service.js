import { Transaction } from '../models/transaction.model.js';
import { ApiError } from '../utils/ApiError.js';
import { runInTransaction } from '../config/db.js';
import { LEDGER_DIRECTION, TRANSACTION_STATUS, TRANSACTION_TYPE, WALLET_STATUS } from '../constants/index.js';
import { findUserWalletByReference, getSettlementWallet, getWalletForUser } from './wallet.service.js';
import { postMovement } from './ledger.service.js';

const sameId = (a, b) => String(a) === String(b);

/**
 * A repeated request with the same Idempotency-Key returns the original transaction
 * instead of moving money again. Reusing a key for a *different* request is an error.
 */
function toReplay(existing, request) {
  const matches =
    existing.type === request.type &&
    existing.amount === request.amount &&
    sameId(existing.source, request.source) &&
    sameId(existing.destination, request.destination);

  if (!matches) {
    throw ApiError.unprocessable('Idempotency-Key was already used with a different request');
  }
  return { transaction: existing, replayed: true };
}

/**
 * Moves money for an already-recorded (pending) transaction.
 * Balances, ledger entries and the status change commit together or not at all.
 * If processing fails, the transaction is kept and marked failed with a reason,
 * so there is an audit trail and no money has moved.
 */
async function settleTransaction(transaction, movements) {
  try {
    await runInTransaction(async (session) => {
      for (const movement of movements) {
        await postMovement({ ...movement, transactionId: transaction._id }, session);
      }
      await Transaction.updateOne(
        { _id: transaction._id },
        { status: TRANSACTION_STATUS.COMPLETED, completedAt: new Date() },
        { session }
      );
    });
  } catch (error) {
    await Transaction.updateOne(
      { _id: transaction._id, status: TRANSACTION_STATUS.PENDING },
      {
        status: TRANSACTION_STATUS.FAILED,
        failureReason: error.isOperational ? error.message : 'Internal processing error',
      }
    );
    throw error;
  }
  return Transaction.findById(transaction._id);
}

/**
 * Shared pipeline for every money-moving request:
 * idempotency check -> record as pending -> settle (ledger + balances) -> completed/failed.
 */
async function processTransaction({ userId, idempotencyKey, request, currency, description, movements }) {
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ initiatedBy: userId, idempotencyKey });
    if (existing) return toReplay(existing, request);
  }

  let transaction;
  try {
    transaction = await Transaction.create({
      ...request,
      currency,
      description,
      initiatedBy: userId,
      idempotencyKey,
    });
  } catch (error) {
    // Two identical requests raced: the unique index let only one through.
    if (error.code === 11000 && idempotencyKey) {
      const existing = await Transaction.findOne({ initiatedBy: userId, idempotencyKey });
      if (existing) return toReplay(existing, request);
    }
    throw error;
  }

  const completed = await settleTransaction(transaction, movements);
  return { transaction: completed, replayed: false };
}

async function getActiveWalletForUser(walletId, userId) {
  const wallet = await getWalletForUser(walletId, userId);
  if (wallet.status !== WALLET_STATUS.ACTIVE) {
    throw ApiError.unprocessable(`Wallet is ${wallet.status}`);
  }
  return wallet;
}

export async function createDeposit({ userId, walletId, amount, description, idempotencyKey }) {
  const wallet = await getActiveWalletForUser(walletId, userId);
  const settlementWallet = await getSettlementWallet(wallet.currency);

  return processTransaction({
    userId,
    idempotencyKey,
    currency: wallet.currency,
    description: description || 'Wallet deposit',
    request: {
      type: TRANSACTION_TYPE.DEPOSIT,
      amount,
      source: settlementWallet._id,
      destination: wallet._id,
    },
    movements: [
      { walletId: settlementWallet._id, direction: LEDGER_DIRECTION.DEBIT, amount },
      { walletId: wallet._id, direction: LEDGER_DIRECTION.CREDIT, amount },
    ],
  });
}

export async function createWithdrawal({ userId, walletId, amount, description, idempotencyKey }) {
  const wallet = await getActiveWalletForUser(walletId, userId);
  const settlementWallet = await getSettlementWallet(wallet.currency);

  // The user's wallet is debited first. The balance check happens inside that atomic
  // update, so an overdraw fails here and nothing else is written.
  return processTransaction({
    userId,
    idempotencyKey,
    currency: wallet.currency,
    description: description || 'Wallet withdrawal',
    request: {
      type: TRANSACTION_TYPE.WITHDRAWAL,
      amount,
      source: wallet._id,
      destination: settlementWallet._id,
    },
    movements: [
      { walletId: wallet._id, direction: LEDGER_DIRECTION.DEBIT, amount },
      { walletId: settlementWallet._id, direction: LEDGER_DIRECTION.CREDIT, amount },
    ],
  });
}

export async function createTransfer({
  userId,
  sourceWalletId,
  destinationReference,
  amount,
  description,
  idempotencyKey,
}) {
  const source = await getActiveWalletForUser(sourceWalletId, userId);

  const destination = await findUserWalletByReference(destinationReference);
  if (!destination) throw ApiError.notFound('Destination wallet not found');
  if (sameId(source._id, destination._id)) {
    throw ApiError.badRequest('Cannot transfer to the same wallet');
  }
  if (source.currency !== destination.currency) {
    throw ApiError.unprocessable('Wallets must use the same currency');
  }
  if (destination.status !== WALLET_STATUS.ACTIVE) {
    throw ApiError.unprocessable('Destination wallet is not active');
  }

  // Both sides are posted inside one database transaction: either A is debited and B is
  // credited, or neither is. The debit goes first so an overdraw fails before anything else.
  return processTransaction({
    userId,
    idempotencyKey,
    currency: source.currency,
    description: description || 'Wallet transfer',
    request: {
      type: TRANSACTION_TYPE.TRANSFER,
      amount,
      source: source._id,
      destination: destination._id,
    },
    movements: [
      { walletId: source._id, direction: LEDGER_DIRECTION.DEBIT, amount },
      { walletId: destination._id, direction: LEDGER_DIRECTION.CREDIT, amount },
    ],
  });
}
