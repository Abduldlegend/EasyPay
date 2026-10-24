// The API deals in integer minor units (kobo / cents). 100000 = NGN 1,000.00.
export const MAX_AMOUNT_MINOR = 1_000_000_000;

/**
 * Converts what a user typed ("1,500.50") to minor units without floating point maths.
 * Returns null when the input is not a valid amount with at most 2 decimal places.
 */
export function toMinorUnits(input) {
  const cleaned = String(input ?? '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function formatMoney(minorUnits, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(minorUnits / 100);
}
