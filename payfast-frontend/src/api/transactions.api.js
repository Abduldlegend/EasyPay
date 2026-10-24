import { http } from './client.js';

const withKey = (idempotencyKey) => ({ headers: { 'Idempotency-Key': idempotencyKey } });

/** Each money call resolves to { transaction, replayed }. Always check transaction.status. */
async function moneyRequest(path, body, idempotencyKey) {
  const { data, status } = await http.post(path, body, withKey(idempotencyKey));
  return { transaction: data.transaction, replayed: status === 200 };
}

export const deposit = ({ walletId, amount, description, idempotencyKey }) =>
  moneyRequest('/transactions/deposits', { walletId, amount, description }, idempotencyKey);

export const withdraw = ({ walletId, amount, description, idempotencyKey }) =>
  moneyRequest('/transactions/withdrawals', { walletId, amount, description }, idempotencyKey);

export const transfer = ({ sourceWalletId, destinationWalletReference, amount, description, idempotencyKey }) =>
  moneyRequest(
    '/transactions/transfers',
    { sourceWalletId, destinationWalletReference, amount, description },
    idempotencyKey
  );

export const listTransactions = async (query) => (await http.get('/transactions', { query })).data;
export const getTransaction = async (reference) => (await http.get(`/transactions/${reference}`)).data;
