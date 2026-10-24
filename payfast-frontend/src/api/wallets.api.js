import { http } from './client.js';

export const createWallet = async (currency) =>
  (await http.post('/wallets', { currency })).data.wallet;
export const listWallets = async () => (await http.get('/wallets')).data.wallets;
export const getWallet = async (walletId) => (await http.get(`/wallets/${walletId}`)).data.wallet;
export const getWalletLedger = async (walletId, { page = 1, limit = 10 } = {}) =>
  (await http.get(`/wallets/${walletId}/ledger`, { query: { page, limit } })).data;
