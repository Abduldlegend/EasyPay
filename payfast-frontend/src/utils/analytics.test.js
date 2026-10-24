import { describe, expect, it } from 'vitest';
import { buildBalanceTrend, buildBreakdown, buildCashFlow, summarize } from './analytics.js';

const now = new Date(2026, 9, 6, 12, 0); // 6 Oct 2026, local noon
const at = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const tx = (overrides) => ({ status: 'completed', currency: 'NGN', type: 'deposit', direction: 'credit', amount: 1000, createdAt: at(5), ...overrides });

describe('buildCashFlow', () => {
  it('returns one zero-filled bucket per day, oldest first', () => {
    const data = buildCashFlow([], { days: 7, currency: 'NGN', now });
    expect(data).toHaveLength(7);
    expect(data[0].date).toBe('2026-09-30');
    expect(data[6].date).toBe('2026-10-06');
    expect(data.every((day) => day.moneyIn === 0 && day.moneyOut === 0)).toBe(true);
  });

  it('adds money in and out on the right day', () => {
    const data = buildCashFlow(
      [tx({ amount: 5000 }), tx({ amount: 2000, direction: 'debit', type: 'withdrawal' }), tx({ amount: 300, createdAt: at(6) })],
      { days: 7, currency: 'NGN', now }
    );
    const oct5 = data.find((day) => day.date === '2026-10-05');
    expect(oct5).toMatchObject({ moneyIn: 5000, moneyOut: 2000 });
    expect(data.find((day) => day.date === '2026-10-06').moneyIn).toBe(300);
  });

  it('ignores failed, pending, other-currency and out-of-range transactions', () => {
    const data = buildCashFlow(
      [tx({ status: 'failed' }), tx({ status: 'pending' }), tx({ currency: 'USD' }), tx({ createdAt: at(1) })],
      { days: 3, currency: 'NGN', now }
    );
    expect(data.reduce((sum, day) => sum + day.moneyIn + day.moneyOut, 0)).toBe(0);
  });
});

describe('buildBreakdown', () => {
  it('groups by type and transfer direction, largest first', () => {
    const result = buildBreakdown(
      [
        tx({ amount: 9000 }),
        tx({ type: 'withdrawal', direction: 'debit', amount: 2000 }),
        tx({ type: 'transfer', direction: 'debit', amount: 3000 }),
        tx({ type: 'transfer', direction: 'credit', amount: 500 }),
        tx({ status: 'failed', amount: 99999 }),
      ],
      { days: 30, currency: 'NGN', now }
    );
    expect(result.map((row) => [row.name, row.value])).toEqual([
      ['Deposits', 9000],
      ['Transfers sent', 3000],
      ['Withdrawals', 2000],
      ['Transfers received', 500],
    ]);
  });
});

describe('summarize', () => {
  it('computes totals, net and success rate', () => {
    const result = summarize(
      [tx({ amount: 5000 }), tx({ type: 'withdrawal', direction: 'debit', amount: 2000 }), tx({ status: 'failed' }), tx({ status: 'pending' })],
      { days: 30, currency: 'NGN', now }
    );
    expect(result).toEqual({ moneyIn: 5000, moneyOut: 2000, net: 3000, count: 4, successRate: 67 });
  });

  it('has no success rate without finished transactions', () => {
    expect(summarize([], { days: 30, currency: 'NGN', now }).successRate).toBeNull();
  });
});

describe('buildBalanceTrend', () => {
  it('orders oldest first and starts from the opening balance', () => {
    const entries = [ // API order: newest first
      { createdAt: at(5, 12), balanceBefore: 8000, balanceAfter: 6000 },
      { createdAt: at(4, 12), balanceBefore: 0, balanceAfter: 8000 },
    ];
    expect(buildBalanceTrend(entries).map((point) => point.balance)).toEqual([0, 8000, 6000]);
  });

  it('returns nothing for no entries', () => {
    expect(buildBalanceTrend([])).toEqual([]);
  });
});
