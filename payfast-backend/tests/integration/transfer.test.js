import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { transferSchema } from '../../src/validators/transaction.validator.js';
import { ApiError } from '../../src/utils/ApiError.js';
import * as transactionService from '../../src/services/transaction.service.js';
import { Transaction } from '../../src/models/transaction.model.js';
import { findUserWalletByReference, getWalletForUser } from '../../src/services/wallet.service.js';
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
  findUserWalletByReference: vi.fn(),
}));
vi.mock('../src/services/ledger.service.js', () => ({ postMovement: vi.fn() }));

const walletId = 'a'.repeat(24);
const REF = 'WLT-9F3A1C07B2';

describe('transfer validator', () => {
  const parse = (body) => transferSchema.safeParse({ body, headers: {} });
  const valid = { sourceWalletId: walletId, destinationWalletReference: REF, amount: 5000000 };

  it('accepts a valid transfer and normalises the reference', () => {
    const result = parse({ ...valid, destinationWalletReference: ' wlt-9f3a1c07b2 ' });
    expect(result.success).toBe(true);
    expect(result.data.body.destinationWalletReference).toBe(REF);
  });

  it.each([
    ['bad reference', { ...valid, destinationWalletReference: 'ABC' }],
    ['float amount', { ...valid, amount: 1.5 }],
    ['zero amount', { ...valid, amount: 0 }],
    ['bad source id', { ...valid, sourceWalletId: 'nope' }],
    ['missing destination', { sourceWalletId: walletId, amount: 100 }],
  ])('rejects %s', (_label, body) => {
    expect(parse(body).success).toBe(false);
  });
});

describe('createTransfer', () => {
  const input = {
    userId: 'u1',
    sourceWalletId: 'wA',
    destinationReference: REF,
    amount: 5000000,
  };
  const walletA = { _id: 'wA', currency: 'NGN', status: 'active' };
  const walletB = { _id: 'wB', currency: 'NGN', status: 'active' };

  beforeEach(() => {
    vi.clearAllMocks();
    getWalletForUser.mockResolvedValue(walletA);
    findUserWalletByReference.mockResolvedValue(walletB);
    Transaction.findOne.mockResolvedValue(null);
    Transaction.create.mockResolvedValue({ _id: 't1' });
    Transaction.findById.mockResolvedValue({ _id: 't1', status: 'completed' });
  });

  it('records both sides: debit A, credit B, same amount, one session', async () => {
    const result = await transactionService.createTransfer(input);

    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer', source: 'wA', destination: 'wB', amount: 5000000 })
    );
    expect(postMovement.mock.calls.map(([m]) => [m.walletId, m.direction, m.amount])).toEqual([
      ['wA', 'debit', 5000000],
      ['wB', 'credit', 5000000],
    ]);
    expect(postMovement.mock.calls.every(([, session]) => session === 'SESSION')).toBe(true);
    expect(result.replayed).toBe(false);
  });

  it('rejects a transfer to the same wallet', async () => {
    findUserWalletByReference.mockResolvedValue({ ...walletA });
    await expect(transactionService.createTransfer(input)).rejects.toMatchObject({ statusCode: 400 });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown destination', async () => {
    findUserWalletByReference.mockResolvedValue(null);
    await expect(transactionService.createTransfer(input)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects a currency mismatch', async () => {
    findUserWalletByReference.mockResolvedValue({ ...walletB, currency: 'USD' });
    await expect(transactionService.createTransfer(input)).rejects.toMatchObject({ statusCode: 422 });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive destination', async () => {
    findUserWalletByReference.mockResolvedValue({ ...walletB, status: 'frozen' });
    await expect(transactionService.createTransfer(input)).rejects.toMatchObject({ statusCode: 422 });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('rejects a transfer from a wallet the user does not own', async () => {
    getWalletForUser.mockRejectedValue(ApiError.notFound('Wallet not found'));
    await expect(transactionService.createTransfer(input)).rejects.toMatchObject({ statusCode: 404 });
    expect(postMovement).not.toHaveBeenCalled();
  });

  it('insufficient balance: fails the transaction and never touches B', async () => {
    postMovement.mockRejectedValueOnce(ApiError.unprocessable('Insufficient balance'));

    await expect(transactionService.createTransfer(input)).rejects.toMatchObject({ statusCode: 422 });

    expect(postMovement).toHaveBeenCalledTimes(1);
    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 't1', status: 'pending' },
      { status: 'failed', failureReason: 'Insufficient balance' }
    );
  });

  it('failure after the debit (credit side) marks the transfer failed and rethrows', async () => {
    postMovement
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(ApiError.unprocessable('Wallet is frozen'));

    await expect(transactionService.createTransfer(input)).rejects.toMatchObject({ statusCode: 422 });

    expect(postMovement).toHaveBeenCalledTimes(2);
    // the completed-status update is only reached when both sides succeed
    expect(Transaction.updateOne).not.toHaveBeenCalledWith(
      { _id: 't1' },
      expect.objectContaining({ status: 'completed' }),
      expect.anything()
    );
    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 't1', status: 'pending' },
      { status: 'failed', failureReason: 'Wallet is frozen' }
    );
  });

  it('submitting the same transfer twice returns the original, moving money once', async () => {
    const original = { _id: 't0', type: 'transfer', amount: 5000000, source: 'wA', destination: 'wB' };
    Transaction.findOne.mockResolvedValue(original);

    const result = await transactionService.createTransfer({ ...input, idempotencyKey: 'key-12345' });

    expect(result).toEqual({ transaction: original, replayed: true });
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(postMovement).not.toHaveBeenCalled();
  });

  it('rejects a key reused for a different recipient', async () => {
    Transaction.findOne.mockResolvedValue({
      _id: 't0', type: 'transfer', amount: 5000000, source: 'wA', destination: 'wOther',
    });

    await expect(
      transactionService.createTransfer({ ...input, idempotencyKey: 'key-12345' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(postMovement).not.toHaveBeenCalled();
  });
});

describe('transfer route', () => {
  it('requires authentication', async () => {
    const res = await request(createApp()).post('/api/v1/transactions/transfers').send({});
    expect(res.status).toBe(401);
  });
});
