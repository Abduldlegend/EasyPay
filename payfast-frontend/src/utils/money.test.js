import { describe, expect, it } from 'vitest';
import { formatMoney, toMinorUnits } from './money.js';

describe('toMinorUnits', () => {
  it.each([
    ['1000', 100000],
    ['1,500.50', 150050],
    ['0.5', 50],
    ['0.05', 5],
    ['10.', null],
    [' 25.25 ', 2525],
    ['19.99', 1999],
  ])('%s -> %s', (input, expected) => {
    expect(toMinorUnits(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1e3', '1.2.3', null, undefined])('rejects %s', (input) => {
    expect(toMinorUnits(input)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats minor units with two decimals', () => {
    expect(formatMoney(150050, 'USD')).toMatch(/1,500\.50/);
    expect(formatMoney(0, 'NGN')).toMatch(/0\.00/);
  });
});
