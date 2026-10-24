import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postMovement } from '../../src/services/ledger.service.js';
import { Wallet } from '../../src/models/wallet.model.js';
import { LedgerEntry } from '../../src/models/ledgerEntry.model.js';

vi.mock('../src/models/wallet.model.js', () => ({
  Wallet: { findOneAndUpdate: vi.fn(), findById: vi.fn() },
}));
vi.mock('../src/models/ledgerEntry.model.js', () => ({
  LedgerEntry: { create: vi.fn() },
}));

const SESSION = { id: 'session' };
const movement = { transactionId: 't1', walletId: 'w1', amount: 5000 };

describe('ledger postMovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    LedgerEntry.create.mockImplementation(async ([entry]) => [entry]);
  });

  it('credits a wallet and records balance before/after', async () => {
    Wallet.findOneAndUpdate.mockResolvedValue({ _id: 'w1', currency: 'NGN', balance: 15000 });

    const entry = await postMovement({ ...movement, direction: 'credit' }, SESSION);

    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'w1', status: 'active' },
      { $inc: { balance: 5000 } },
      { returnDocument: 'after', session: SESSION }
    );
    expect(entry).toMatchObject({ direction: 'credit', balanceBefore: 10000, balanceAfter: 15000 });
    expect(LedgerEntry.create).toHaveBeenCalledWith([expect.any(Object)], { session: SESSION });
  });

  it('guards user-wallet debits with a balance check inside the update', async () => {
    Wallet.findOneAndUpdate.mockResolvedValue({ _id: 'w1', currency: 'NGN', balance: 5000 });

    const entry = await postMovement({ ...movement, direction: 'debit' }, SESSION);

    const [filter, update] = Wallet.findOneAndUpdate.mock.calls[0];
    expect(filter.$or).toEqual([{ type: 'system' }, { balance: { $gte: 5000 } }]);
    expect(update).toEqual({ $inc: { balance: -5000 } });
    expect(entry).toMatchObject({ balanceBefore: 10000, balanceAfter: 5000 });
  });

  it('reports insufficient balance and writes no ledger entry', async () => {
    Wallet.findOneAndUpdate.mockResolvedValue(null);
    Wallet.findById.mockReturnValue({ session: async () => ({ status: 'active' }) });

    await expect(postMovement({ ...movement, direction: 'debit' }, SESSION)).rejects.toMatchObject({
      statusCode: 422,
      message: 'Insufficient balance',
    });
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });

  it('refuses movements on frozen wallets', async () => {
    Wallet.findOneAndUpdate.mockResolvedValue(null);
    Wallet.findById.mockReturnValue({ session: async () => ({ status: 'frozen' }) });

    await expect(postMovement({ ...movement, direction: 'credit' }, SESSION)).rejects.toMatchObject({
      statusCode: 422,
      message: 'Wallet is frozen',
    });
  });

  it('reports a missing wallet as not found', async () => {
    Wallet.findOneAndUpdate.mockResolvedValue(null);
    Wallet.findById.mockReturnValue({ session: async () => null });

    await expect(postMovement({ ...movement, direction: 'credit' }, SESSION)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
