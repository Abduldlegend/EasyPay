import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { buildDailyTrend, getAdminStats } from '../../src/services/adminStats.service.js';
import { signToken } from '../../src/utils/jwt.js';
import { User } from '../../src/models/user.model.js';
import { Wallet } from '../../src/models/wallet.model.js';
import { Transaction } from '../../src/models/transaction.model.js';

vi.mock('../src/models/user.model.js', () => ({ User: { findById: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../src/models/wallet.model.js', () => ({ Wallet: { aggregate: vi.fn() } }));
vi.mock('../src/models/transaction.model.js', () => ({ Transaction: { aggregate: vi.fn() } }));

const NOW = new Date('2026-10-22T10:00:00Z');

const mockData = () => {
  // countDocuments is called in order: total, disabled, admins, new in 7 days.
  User.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(4);
  Wallet.aggregate
    .mockResolvedValueOnce([{ _id: 'active', count: 7 }, { _id: 'frozen', count: 1 }])
    .mockResolvedValueOnce([{ _id: 'NGN', wallets: 6, totalBalance: 500000 }]);
  Transaction.aggregate
    .mockResolvedValueOnce([{ _id: 'completed', count: 9 }, { _id: 'failed', count: 2 }])
    .mockResolvedValueOnce([{ _id: { currency: 'NGN', type: 'deposit' }, count: 5, volume: 900000 }])
    .mockResolvedValueOnce([{ _id: { day: '2026-10-21', currency: 'NGN' }, count: 3, volume: 120000 }]);
};

beforeEach(() => vi.clearAllMocks());

describe('getAdminStats', () => {
  it('shapes users, wallets, transactions and per-currency totals', async () => {
    mockData();
    const stats = await getAdminStats(NOW);

    expect(stats.users).toEqual({ total: 10, active: 8, disabled: 2, admins: 1, newLast7Days: 4 });
    expect(stats.wallets).toEqual({ total: 8, byStatus: { active: 7, frozen: 1, closed: 0 } });
    expect(stats.transactions.total).toBe(11);
    expect(stats.transactions.byStatus).toMatchObject({ completed: 9, failed: 2, pending: 0 });

    const ngn = stats.currencies.find((c) => c.currency === 'NGN');
    expect(ngn).toMatchObject({ wallets: 6, totalBalance: 500000 });
    expect(ngn.volumeByType.deposit).toEqual({ count: 5, volume: 900000 });
    expect(ngn.volumeByType.withdrawal).toEqual({ count: 0, volume: 0 });

    const usd = stats.currencies.find((c) => c.currency === 'USD');
    expect(usd).toMatchObject({ wallets: 0, totalBalance: 0 });
  });

  it('excludes the system wallet from wallet and balance totals', async () => {
    mockData();
    await getAdminStats(NOW);
    expect(Wallet.aggregate.mock.calls[0][0][0]).toEqual({ $match: { type: { $ne: 'system' } } });
    expect(Wallet.aggregate.mock.calls[1][0][0]).toEqual({ $match: { type: { $ne: 'system' } } });
  });

  it('only counts completed transactions as volume', async () => {
    mockData();
    await getAdminStats(NOW);
    expect(Transaction.aggregate.mock.calls[1][0][0].$match.status).toBe('completed');
  });
});

describe('buildDailyTrend', () => {
  it('returns one zero-filled entry per day, oldest first, ending today', () => {
    const rows = [{ _id: { day: '2026-10-21', currency: 'NGN' }, count: 3, volume: 120000 }];
    const trend = buildDailyTrend(rows, 14, NOW);

    expect(trend).toHaveLength(14);
    expect(trend[0].date).toBe('2026-10-09');
    expect(trend[13].date).toBe('2026-10-22');
    expect(trend[12].NGN).toEqual({ count: 3, volume: 120000 });
    expect(trend[13].NGN).toEqual({ count: 0, volume: 0 });
    expect(trend[13].USD).toEqual({ count: 0, volume: 0 });
  });

  it('ignores rows outside the window', () => {
    const trend = buildDailyTrend([{ _id: { day: '2020-01-01', currency: 'NGN' }, count: 1, volume: 1 }], 14, NOW);
    expect(trend.every((day) => day.NGN.volume === 0)).toBe(true);
  });
});

describe('GET /api/v1/admin/stats access control', () => {
  const app = createApp();
  const token = (role) => `Bearer ${signToken({ sub: 'u1', role })}`;

  it('401 without a token, 403 for a user', async () => {
    expect((await request(app).get('/api/v1/admin/stats')).status).toBe(401);
    User.findById.mockResolvedValue({ id: 'u1', role: 'user', status: 'active' });
    const res = await request(app).get('/api/v1/admin/stats').set('Authorization', token('user'));
    expect(res.status).toBe(403);
  });

  it('200 with stats for an admin', async () => {
    User.findById.mockResolvedValue({ id: 'u1', role: 'admin', status: 'active' });
    mockData();
    const res = await request(app).get('/api/v1/admin/stats').set('Authorization', token('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.stats.users.total).toBe(10);
    expect(res.body.data.stats.trend).toHaveLength(14);
  });
});