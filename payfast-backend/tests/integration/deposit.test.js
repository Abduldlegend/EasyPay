import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { depositSchema } from '../../src/validators/transaction.validator.js';
import { ApiError } from '../../src/utils/ApiError.js';
import * as transactionService from '../../src/services/transaction.service.js';
import { Transaction } from '../../src/models/transaction.model.js';
import { getSettlementWallet, getWalletForUser } from '../../src/services/wallet.service.js';
import { postMovement } from '../../src/services/ledger.service.js';

vi.mock('../src/config/db.js', () => ({
  connectDatabase: vi.fn(),
  runInTransaction: vi.fn((work) => work('SESSION')),
}));
vi.mock('../src/models/transaction.model.js', () => ({
  Transaction: { create: vi.fn(), findOne: vi.fn(), findById: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../src/services/wallet.service.js', () => ({
  getWalletForUser: vi.fn(),
  getSettlementWallet: vi.fn(),
}));
vi.mock('../src/services/ledger.service.js', () => ({ postMovement: vi.fn() }));

const walletId = 'a'.repeat(24);

describe('deposit validator', () => {
  const parse = (body, headers = {}) => depositSchema.safeParse({ body, headers });

  it('accepts a valid deposit', () => {
    expect(parse({ walletId, amount: 10000000 }).success).toBe(true);
  });

  it.each([
    ['float amount', { walletId, amount: 10.5 }],
    ['zero amount', { walletId, amount: 0 }],
    ['negative amount', { walletId, amount: -100 }],
    ['string amount', { walletId, amount: '100' }],
    ['over the limit', { walletId, amount: 1_000_000_001 }],
    ['bad wallet id', { walletId: 'x', amount: 100 }],
    ['long description', { walletId, amount: 100, description: 'x'.repeat(141) }],
  ])('rejects %s', (_label, body) => {
    expect(parse(body).success).toBe(false);
  });

  it('rejects a too-short idempotency key', () => {
    expect(parse({ walletId, amount: 100 }, { 'idempotency-key': 'abc' }).success).toBe(false);
  });
});

describe('createDeposit', () => {
  const input = { userId: 'u1', walletId: 'w1', amount: 50000 };
  const wallet = { _id: 'w1', currency: 'NGN', status: 'active' };
  const settlement = { _id: 'sys1', currency: 'NGN' };

  beforeEach(() => {
    vi.clearAllMocks();
    getWalletForUser.mockResolvedValue(wallet);
    getSettlementWallet.mockResolvedValue(settlement);
    Transaction.findOne.mockResolvedValue(null);
    Transaction.create.mockResolvedValue({ _id: 't1' });
    Transaction.findById.mockResolvedValue({ _id: 't1', status: 'completed' });
  });

  it('debits settlement, credits the wallet and completes the transaction', async () => {
    const result = await transactionService.createDeposit(input);

    expect(postMovement.mock.calls.map(([m]) => [m.walletId, m.direction, m.amount])).toEqual([
      ['sys1', 'debit', 50000],
      ['w1', 'credit', 50000],
    ]);
    expect(postMovement.mock.calls[0][1]).toBe('SESSION');
    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 't1' },
      expect.objectContaining({ status: 'completed' }),
      { session: 'SESSION' }
    );
    expect(result).toEqual({ transaction: { _id: 't1', status: 'completed' }, replayed: false });
  });

  it('marks the transaction failed (with a reason) when processing fails, and rethrows', async () => {
    postMovement.mockRejectedValueOnce(ApiError.unprocessable('Wallet is frozen'));

    await expect(transactionService.createDeposit(input)).rejects.toMatchObject({ statusCode: 422 });
    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 't1', status: 'pending' },
      { status: 'failed', failureReason: 'Wallet is frozen' }
    );
  });

  it('hides unexpected error details in the stored failure reason', async () => {
    postMovement.mockRejectedValueOnce(new Error('connection string leaked'));

    await expect(transactionService.createDeposit(input)).rejects.toThrow();
    expect(Transaction.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      { status: 'failed', failureReason: 'Internal processing error' }
    );
  });

  it('refuses deposits into inactive wallets', async () => {
    getWalletForUser.mockResolvedValue({ ...wallet, status: 'frozen' });
    await expect(transactionService.createDeposit(input)).rejects.toMatchObject({ statusCode: 422 });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('replays the original transaction for a repeated idempotency key', async () => {
    const original = { _id: 't0', type: 'deposit', amount: 50000, source: 'sys1', destination: 'w1' };
    Transaction.findOne.mockResolvedValue(original);

    const result = await transactionService.createDeposit({ ...input, idempotencyKey: 'key-12345' });

    expect(result).toEqual({ transaction: original, replayed: true });
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(postMovement).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused with a different amount', async () => {
    Transaction.findOne.mockResolvedValue({ _id: 't0', type: 'deposit', amount: 1, source: 'sys1', destination: 'w1' });

    await expect(
      transactionService.createDeposit({ ...input, idempotencyKey: 'key-12345' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(postMovement).not.toHaveBeenCalled();
  });

  it('resolves a race on the idempotency key to the winning transaction', async () => {
    const winner = { _id: 't0', type: 'deposit', amount: 50000, source: 'sys1', destination: 'w1' };
    Transaction.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    Transaction.create.mockRejectedValue({ code: 11000 });

    const result = await transactionService.createDeposit({ ...input, idempotencyKey: 'key-12345' });
    expect(result.replayed).toBe(true);
    expect(postMovement).not.toHaveBeenCalled();
  });
});

describe('deposit and ledger routes', () => {
  const app = createApp();

  it('requires authentication to deposit', async () => {
    expect((await request(app).post('/api/v1/transactions/deposits').send({})).status).toBe(401);
  });

  it('requires authentication to read a ledger', async () => {
    expect((await request(app).get(`/api/v1/wallets/${walletId}/ledger`)).status).toBe(401);
  });
});
