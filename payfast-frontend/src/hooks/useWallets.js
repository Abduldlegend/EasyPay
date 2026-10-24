import { listWallets } from '../api/wallets.api.js';
import { useFetch } from './useFetch.js';

export const useWallets = () => useFetch(listWallets, []);
