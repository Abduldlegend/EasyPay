import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as transactionService from '../services/transaction.service.js';
import * as historyService from '../services/transactionHistory.service.js';

/** Builds a controller for a single-wallet money request (deposit / withdrawal). */
function walletMoneyController(serviceFn, label) {
  return asyncHandler(async (req, res) => {
    const { walletId, amount, description } = req.validated.body;

    const { transaction, replayed } = await serviceFn({
      userId: req.user.id,
      walletId,
      amount,
      description,
      idempotencyKey: req.validated.headers['idempotency-key'],
    });

    sendSuccess(res, {
      statusCode: replayed ? 200 : 201,
      message: replayed
        ? `Duplicate request: returning the original ${label}`
        : `${label[0].toUpperCase()}${label.slice(1)} successful`,
      data: { transaction },
    });
  });
}

export const createDeposit = walletMoneyController(transactionService.createDeposit, 'deposit');
export const createWithdrawal = walletMoneyController(
  transactionService.createWithdrawal,
  'withdrawal'
);

export const createTransfer = asyncHandler(async (req, res) => {
  const { sourceWalletId, destinationWalletReference, amount, description } = req.validated.body;

  const { transaction, replayed } = await transactionService.createTransfer({
    userId: req.user.id,
    sourceWalletId,
    destinationReference: destinationWalletReference,
    amount,
    description,
    idempotencyKey: req.validated.headers['idempotency-key'],
  });

  sendSuccess(res, {
    statusCode: replayed ? 200 : 201,
    message: replayed
      ? 'Duplicate request: returning the original transfer'
      : 'Transfer successful',
    data: { transaction },
  });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const result = await historyService.listTransactionsForUser(req.user.id, req.validated.query);
  sendSuccess(res, { data: result });
});

export const getTransaction = asyncHandler(async (req, res) => {
  const result = await historyService.getTransactionForUser(req.user.id, req.params.reference);
  sendSuccess(res, { data: result });
});
