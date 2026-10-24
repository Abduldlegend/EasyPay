import { listTransactions } from '../api/transactions.api.js';
import { getWalletLedger } from '../api/wallets.api.js';
import { dayKey, periodStart } from '../utils/analytics.js';
import { useFetch } from './useFetch.js';

export const ANALYTICS_LIMIT = 100; // the API's maximum page size

/** Latest transactions for a period. Fetches one extra day so timezone edges are never cut off. */
export const usePeriodTransactions = (days) =>
  useFetch(() => listTransactions({ from: dayKey(periodStart(days + 1)), limit: ANALYTICS_LIMIT }), [days]);

/** Latest ledger entries for one wallet (used for the balance trend). */
export const useWalletLedger = (walletId) =>
  useFetch(
    () => (walletId ? getWalletLedger(walletId, { page: 1, limit: ANALYTICS_LIMIT }) : Promise.resolve({ entries: [] })),
    [walletId]
  );
