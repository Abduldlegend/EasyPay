import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
    buildTransactionFilter,
    checkLedger,
    getTransactionDetail,
    listAllTransactions,
} from '../src/services/adminTransaction.service.js';
import { adminTransactionsQuerySchema } from '../src/validators/admin.validator.js';
import { signToken } from '../src/utils/jwt.js';
import { User } from '../src/models/user.model.js';
import { Wallet } from '../src/models/wallet.model.js';
import { Transaction } from '../src/models/transaction.model.js';
import { LedgerEntry } from '../src/models/ledgerEntry.model.js';

vi.mock('../src/models/user.model.js', () => ({ User: { findById: vi.fn(), findOne: vi.fn() } }));
vi.mock('../src/models/wallet.model.js', () => ({ Wallet: { findOne: vi.fn() } }));
vi.mock('../src/models/transaction.model.js', () => ({
    Transaction: { find: vi.fn(), findOne: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../src/models/ledgerEntry.model.js', () => ({ LedgerEntry: { find: vi.fn() } }));

const select = (value) => ({ select: vi.fn().mockResolvedValue(value) });
const listChain = (rows) => ({
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    populate: vi.fn().mockResolvedValue(rows),
});

beforeEach(() => {
    vi.clearAllMocks();
    Wallet.findOne.mockReturnValue(select(null));
    User.findOne.mockReturnValue(select(null));
});

describe('buildTransactionFilter', () => {
    it('is empty with no filters', async () => {
        expect(await buildTransactionFilter({})).toEqual({});
    });

    it('combines exact filters and the date range', async () => {
        const from = new Date('2026-10-01');
        const filter = await buildTransactionFilter({ type: 'deposit', status: 'failed', currency: 'NGN', from });
        expect(filter.$and).toEqual([
            { type: 'deposit' },
            { status: 'failed' },
            { currency: 'NGN' },
            { createdAt: { $gte: from } },
        ]);
    });

    it('searches transaction references by prefix, case-insensitively', async () => {
        const filter = await buildTransactionFilter({ search: 'txn-ab12' });
        expect(filter.$and[0].$or[0]).toEqual({ reference: { $regex: '^TXN-AB12' } });
    });

    it('escapes regex characters so a search cannot become a pattern', async () => {
        const filter = await buildTransactionFilter({ search: '.*' });
        expect(filter.$and[0].$or[0].reference.$regex).toBe('^\\.\\*');
    });

    it('adds a matching wallet on either side of the transaction', async () => {
        Wallet.findOne.mockReturnValue(select({ _id: 'w1' }));
        const filter = await buildTransactionFilter({ search: 'WLT-0123456789' });
        expect(Wallet.findOne).toHaveBeenCalledWith({ reference: 'WLT-0123456789' });
        expect(filter.$and[0].$or).toEqual(expect.arrayContaining([{ source: 'w1' }, { destination: 'w1' }]));
    });

    it('adds the initiator when the search is a known email', async () => {
        User.findOne.mockReturnValue(select({ _id: 'u9' }));
        const filter = await buildTransactionFilter({ search: 'Ada@Example.com' });
        expect(User.findOne).toHaveBeenCalledWith({ email: 'ada@example.com' });
        expect(filter.$and[0].$or).toContainEqual({ initiatedBy: 'u9' });
    });
});

describe('listAllTransactions', () => {
    it('paginates over every user, not just one', async () => {
        const chain = listChain([{ reference: 'TXN-1' }]);
        Transaction.find.mockReturnValue(chain);
        Transaction.countDocuments.mockResolvedValue(41);

        const result = await listAllTransactions({ page: 2, limit: 20 });

        expect(Transaction.find).toHaveBeenCalledWith({});
        expect(chain.skip).toHaveBeenCalledWith(20);
        expect(result.pagination).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 });
    });
});

describe('checkLedger', () => {
    const entry = (direction, amount, before, after) => ({ direction, amount, balanceBefore: before, balanceAfter: after });

    it('passes a balanced deposit (settlement debit, user credit)', () => {
        const result = checkLedger([entry('debit', 500, 0, -500), entry('credit', 500, 0, 500)]);
        expect(result).toEqual({ debits: 500, credits: 500, balanced: true, entriesAddUp: true });
    });

    it('flags money that was created or lost', () => {
        expect(checkLedger([entry('credit', 500, 0, 500)]).balanced).toBe(false);
    });

    it('flags an entry whose balances do not add up', () => {
        const result = checkLedger([entry('debit', 500, 1000, 400), entry('credit', 500, 0, 500)]);
        expect(result.balanced).toBe(true);
        expect(result.entriesAddUp).toBe(false);
    });

    it('treats a transaction with no entries as balanced', () => {
        expect(checkLedger([])).toMatchObject({ balanced: true, entriesAddUp: true });
    });
});

describe('getTransactionDetail', () => {
    it('404s for an unknown reference', async () => {
        Transaction.findOne.mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
        await expect(getTransactionDetail('TXN-0000000000')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns the transaction with ledger entries and the check', async () => {
        Transaction.findOne.mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: 't1', reference: 'TXN-1' }) });
        const entries = [{ direction: 'debit', amount: 5, balanceBefore: 5, balanceAfter: 0 }, { direction: 'credit', amount: 5, balanceBefore: 0, balanceAfter: 5 }];
        LedgerEntry.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue(entries) }) });

        const result = await getTransactionDetail('TXN-1');

        expect(LedgerEntry.find).toHaveBeenCalledWith({ transaction: 't1' });
        expect(result.ledgerCheck.balanced).toBe(true);
        expect(result.ledgerEntries).toHaveLength(2);
    });
});

describe('query validation', () => {
    const parse = (query) => adminTransactionsQuerySchema.safeParse({ query });

    it('accepts filters and applies pagination defaults', () => {
        const result = parse({ status: 'failed', currency: 'USD', to: '2026-10-05' });
        expect(result.success).toBe(true);
        expect(result.data.query).toMatchObject({ page: 1, limit: 20, status: 'failed' });
        expect(result.data.query.to.toISOString()).toBe('2026-10-05T23:59:59.999Z');
    });

    it.each([
        ['unknown status', { status: 'nope' }],
        ['unknown currency', { currency: 'EUR' }],
        ['reversed dates', { from: '2026-10-05', to: '2026-10-01' }],
        ['over-long search', { search: 'x'.repeat(101) }],
    ])('rejects %s', (_label, query) => {
        expect(parse(query).success).toBe(false);
    });
});

describe('admin transaction routes access control', () => {
    const app = createApp();
    const token = (role) => `Bearer ${signToken({ sub: 'u1', role })}`;

    it.each(['/api/v1/admin/transactions', '/api/v1/admin/transactions/TXN-0123456789'])(
        '%s is 401 without a token and 403 for a user',
        async (url) => {
            expect((await request(app).get(url)).status).toBe(401);
            User.findById.mockResolvedValue({ id: 'u1', role: 'user', status: 'active' });
            expect((await request(app).get(url).set('Authorization', token('user'))).status).toBe(403);
        }
    );

    it('rejects a malformed reference with 400 for an admin', async () => {
        User.findById.mockResolvedValue({ id: 'u1', role: 'admin', status: 'active' });
        const res = await request(app).get('/api/v1/admin/transactions/bad').set('Authorization', token('admin'));
        expect(res.status).toBe(400);
    });

    it('lists transactions for an admin', async () => {
        User.findById.mockResolvedValue({ id: 'u1', role: 'admin', status: 'active' });
        Transaction.find.mockReturnValue(listChain([{ reference: 'TXN-1' }]));
        Transaction.countDocuments.mockResolvedValue(1);
        const res = await request(app).get('/api/v1/admin/transactions?status=failed').set('Authorization', token('admin'));
        expect(res.status).toBe(200);
        expect(res.body.data.transactions).toHaveLength(1);
        expect(Transaction.find).toHaveBeenCalledWith({ $and: [{ status: 'failed' }] });
    });
});