export const USER_ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

export const WALLET_STATUS = Object.freeze({
  ACTIVE: 'active',
  FROZEN: 'frozen',
  CLOSED: 'closed',
});

// "system" wallets are internal counterparties (e.g. the settlement wallet that funds deposits).
export const WALLET_TYPE = Object.freeze({
  USER: 'user',
  SYSTEM: 'system',
});

export const CURRENCIES = Object.freeze({
  NGN: 'NGN',
  USD: 'USD',
});

export const DEFAULT_CURRENCY = CURRENCIES.NGN;

export const TRANSACTION_TYPE = Object.freeze({
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  TRANSFER: 'transfer',
  REVERSAL: 'reversal',
  REFUND: 'refund',
  FEE: 'fee',
});

export const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

export const LEDGER_DIRECTION = Object.freeze({
  CREDIT: 'credit',
  DEBIT: 'debit',
});

// Amounts are integers in minor units (kobo / cents). 1_000_000_000 kobo = NGN 10,000,000.
export const MAX_SINGLE_TRANSACTION_AMOUNT = 1_000_000_000;

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

// What an admin did. Stored on every audit log entry.
export const AUDIT_ACTION = Object.freeze({
  ADMIN_CREATED: 'admin.created',
  USER_DISABLED: 'user.disabled',
  USER_ENABLED: 'user.enabled',
  WALLET_FROZEN: 'wallet.frozen',
  WALLET_UNFROZEN: 'wallet.unfrozen',
  WALLET_CLOSED: 'wallet.closed',
});

export const AUDIT_TARGET = Object.freeze({
  USER: 'user',
  WALLET: 'wallet',
  TRANSACTION: 'transaction',
});

export const API_PREFIX = '/api/v1';
