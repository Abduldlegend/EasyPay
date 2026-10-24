import { randomBytes } from 'crypto';

/** Builds a readable, hard-to-guess reference such as WLT-9F3A1C07B2. */
export function generateReference(prefix) {
  return `${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export const generateWalletReference = () => generateReference('WLT');
export const generateTransactionReference = () => generateReference('TXN');
