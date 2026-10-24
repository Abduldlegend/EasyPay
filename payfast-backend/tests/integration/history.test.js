import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  listTransactionsSchema,
  transactionReferenceParamSchema,
} from '../../src/validators/transaction.validator.js';
import { ApiError } from '../../src/utils/ApiError.js';
import {
  getTransactionForUser,
  listTransactionsForUser,
  presentTransaction,
} from '../../src/services/transactionHistory.service.js';
import { Transaction } from '../../src/models/transaction.model.js';
import { getWalletForUser, getWalletIdsForUser } from '../../src/services/wallet.service.js';
import { listEntriesForTransaction } from '../../src/services/ledger.service.js';

vi.mock('../src/models/transaction.model.js', () => ({
  Transaction: { find: vi.fn(), findOne: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../src/services/wallet.service.js', () => ({
  getWalletForUser: vi.fn(),
  getWalletIdsForUser: vi.fn(),
}));
vi.mock('../src/services/ledger.service.js', () => ({ listEntriesForTransaction: vi.fn() }));

const makeTx = (fields) => ({ toJSON: () => ({ ...fields }), ...fields });
const findChain = (result) => {
  const chain = { sort: () => chain, skip: () => chain, limit: () => chain, populate: async () => result };
  return chain;
};

describe('list validator', () => {
  const parse = (query) => listTransactionsSchema.safeParse({ query });

  it('applies pagination defaults', () => {
    expect(parse({}).data.query).toMatchObject({ page: 1, limit: 20 });
  });

  it('accepts filters', () => {
    const result = parse({ type: 'transfer', status: 'completed', walletId: 'a'.repeat(24) });
    expect(result.success).toBe(true);
  });

  it.each([
    ['unknown type', { type: 'gift' }],
    ['unknown status', { status: 'done' }],
    ['limit above 100', { limit: '500' }],
    ['page zero', { page: '0' }],
    ['bad date', { from: 'yesterday-ish' }],
    ['from after to', { from: '2026-10-05', to: '2026-10-01' }],
    ['bad wallet id', { walletId: 'x' }],
  ])('rejects %s', (_label, query) => {
    expect(parse(query).success).toBe(false);
  });

  it('treats a date-only "to" as the end of that day', () => {
    const { to } = parse({ to: '2026-10-05' }).data.query;
    expect(to.toISOString()).toBe('2026-10-05T23:59:59.999Z');
  });
});

describe('reference validator', () => {
  const parse = (reference) => transactionReferenceParamSchema.safeParse({ params: { reference } });

  it('normalises case', () => {
    expect(parse(' txn-9f3a1c07b2 ').data.params.reference).toBe('TXN-9F3A1C07B2');
  });
  it('rejects malformed references', () => {
    expect(parse('WLT-9F3A1C07B2').success).toBe(false);
  });
});

describe('presentTransaction', () => {
  it('marks money arriving in the viewer wallet as credit, otherwise debit', () => {
    const incoming = makeTx({ destination: { _id: 'wMine' } });
    const outgoing = makeTx({ destination: { _id: 'wTheirs' } });

    expect(presentTransaction(incoming, ['wMine']).direction).toBe('credit');
    expect(presentTransaction(outgoing, ['wMine']).direction).toBe('debit');
  });
});

describe('listTransactionsForUser', () => {
  const base = { page: 2, limit: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
    getWalletIdsForUser.mockResolvedValue(['wMine']);
    Transaction.find.mockReturnValue(findChain([makeTx({ destination: { _id: 'wMine' } })]));
    Transaction.countDocuments.mockResolvedValue(25);
  });

  it('only shows own transactions plus completed incoming ones', async () => {
    await listTransactionsForUser('u1', base);

    const [filter] = Transaction.find.mock.calls[0];
    expect(filter.$and[0]).toEqual({
      $or: [{ initiatedBy: 'u1' }, { destination: { $in: ['wMine'] }, status: 'completed' }],
    });
  });

  it('returns pagination and direction', async () => {
    const result = await listTransactionsForUser('u1', base);

    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
    expect(result.transactions[0].direction).toBe('credit');
  });

  it('adds type, status and date filters', async () => {
    const from = new Date('2026-10-01');
    const to = new Date('2026-10-05');
    await listTransactionsForUser('u1', { ...base, type: 'deposit', status: 'failed', from, to });

    const [filter] = Transaction.find.mock.calls[0];
    expect(filter.$and).toEqual(
      expect.arrayContaining([
        { type: 'deposit' },
        { status: 'failed' },
        { createdAt: { $gte: from, $lte: to } },
      ])
    );
  });

  it('checks wallet ownership before filtering by wallet', async () => {
    getWalletForUser.mockRejectedValue(ApiError.notFound('Wallet not found'));

    await expect(
      listTransactionsForUser('u1', { ...base, walletId: 'wOther' })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(Transaction.find).not.toHaveBeenCalled();
  });

  it('restricts to a wallet the user owns', async () => {
    getWalletForUser.mockResolvedValue({ _id: 'wMine' });
    await listTransactionsForUser('u1', { ...base, walletId: 'wMine' });

    const [filter] = Transaction.find.mock.calls[0];
    expect(filter.$and).toContainEqual({ $or: [{ source: 'wMine' }, { destination: 'wMine' }] });
  });
});

describe('getTransactionForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWalletIdsForUser.mockResolvedValue(['wMine']);
  });

  it('returns the transaction with only the viewer\'s ledger entries', async () => {
    const tx = makeTx({ _id: 't1', destination: { _id: 'wMine' } });
    Transaction.findOne.mockReturnValue({ populate: async () => tx });
    listEntriesForTransaction.mockResolvedValue([{ wallet: 'wMine' }]);

    const result = await getTransactionForUser('u1', 'TXN-9F3A1C07B2');

    expect(listEntriesForTransaction).toHaveBeenCalledWith('t1', ['wMine']);
    expect(result.ledgerEntries).toHaveLength(1);
    expect(result.transaction.direction).toBe('credit');
  });

  it('returns 404 for transactions the user cannot see', async () => {
    Transaction.findOne.mockReturnValue({ populate: async () => null });
    await expect(getTransactionForUser('u1', 'TXN-9F3A1C07B2')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(listEntriesForTransaction).not.toHaveBeenCalled();
  });
});

describe('history routes', () => {
  const app = createApp();
  it.each(['/api/v1/transactions', '/api/v1/transactions/TXN-9F3A1C07B2'])(
    'GET %s requires authentication',
    async (url) => {
      expect((await request(app).get(url)).status).toBe(401);
    }
  );
});
