import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { withdrawalSchema } from '../../src/validators/transaction.validator.js';
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

describe('withdrawal validator', () => {
  const parse = (body) => withdrawalSchema.safeParse({ body, headers: {} });

  it('accepts a valid withdrawal', () => {
    expect(parse({ walletId, amount: 2000000 }).success).toBe(true);
  });

  it.each([
    ['float amount', { walletId, amount: 0.5 }],
    ['zero amount', { walletId, amount: 0 }],
    ['negative amount', { walletId, amount: -5 }],
    ['missing amount', { walletId }],
    ['missing wallet', { amount: 100 }],
  ])('rejects %s', (_label, body) => {
    expect(parse(body).success).toBe(false);
  });
});

describe('createWithdrawal', () => {
  const input = { userId: 'u1', walletId: 'w1', amount: 2000000 };
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

  it('records the wallet as source and settlement as destination', async () => {
    await transactionService.createWithdrawal(input);

    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'withdrawal',
        amount: 2000000,
        currency: 'NGN',
        source: 'w1',
        destination: 'sys1',
        initiatedBy: 'u1',
        description: 'Wallet withdrawal',
      })
    );
  });

  it('debits the wallet first, then credits settlement, and completes', async () => {
    const result = await transactionService.createWithdrawal(input);

    expect(postMovement.mock.calls.map(([m]) => [m.walletId, m.direction, m.amount])).toEqual([
      ['w1', 'debit', 2000000],
      ['sys1', 'credit', 2000000],
    ]);
    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 't1' },
      expect.objectContaining({ status: 'completed' }),
      { session: 'SESSION' }
    );
    expect(result.replayed).toBe(false);
  });

  it('rejects overdrafts: marks the transaction failed, never credits settlement', async () => {
    postMovement.mockRejectedValueOnce(ApiError.unprocessable('Insufficient balance'));

    await expect(transactionService.createWithdrawal(input)).rejects.toMatchObject({
      statusCode: 422,
      message: 'Insufficient balance',
    });

    expect(postMovement).toHaveBeenCalledTimes(1);
    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 't1', status: 'pending' },
      { status: 'failed', failureReason: 'Insufficient balance' }
    );
  });

  it('refuses withdrawals from inactive wallets before recording anything', async () => {
    getWalletForUser.mockResolvedValue({ ...wallet, status: 'closed' });

    await expect(transactionService.createWithdrawal(input)).rejects.toMatchObject({ statusCode: 422 });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('does not let a user withdraw from a wallet they do not own', async () => {
    getWalletForUser.mockRejectedValue(ApiError.notFound('Wallet not found'));

    await expect(transactionService.createWithdrawal(input)).rejects.toMatchObject({ statusCode: 404 });
    expect(postMovement).not.toHaveBeenCalled();
  });

  it('replays instead of withdrawing twice for the same idempotency key', async () => {
    const original = { _id: 't0', type: 'withdrawal', amount: 2000000, source: 'w1', destination: 'sys1' };
    Transaction.findOne.mockResolvedValue(original);

    const result = await transactionService.createWithdrawal({ ...input, idempotencyKey: 'key-12345' });

    expect(result).toEqual({ transaction: original, replayed: true });
    expect(postMovement).not.toHaveBeenCalled();
  });

  it('rejects a key previously used for a deposit', async () => {
    Transaction.findOne.mockResolvedValue({
      _id: 't0', type: 'deposit', amount: 2000000, source: 'sys1', destination: 'w1',
    });

    await expect(
      transactionService.createWithdrawal({ ...input, idempotencyKey: 'key-12345' })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('withdrawal route', () => {
  it('requires authentication', async () => {
    const res = await request(createApp()).post('/api/v1/transactions/withdrawals').send({});
    expect(res.status).toBe(401);
  });
});
