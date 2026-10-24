import { titleCase } from './format.js';

/** Human label for a history row, from the viewer's point of view. */
export function describeTransaction(tx) {
  switch (tx.type) {
    case 'deposit':
      return 'Wallet deposit';
    case 'withdrawal':
      return 'Withdrawal';
    case 'transfer':
      return tx.direction === 'credit'
        ? `Received from ${tx.source?.reference ?? 'a wallet'}`
        : `Sent to ${tx.destination?.reference ?? 'a wallet'}`;
    default:
      return titleCase(tx.type);
  }
}

export const TRANSACTION_TYPES = ['deposit', 'withdrawal', 'transfer'];
export const TRANSACTION_STATUSES = ['completed', 'pending', 'failed'];
export const CURRENCIES = ['NGN', 'USD'];
