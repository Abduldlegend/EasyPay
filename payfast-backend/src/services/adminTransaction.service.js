import { Transaction } from '../models/transaction.model.js';
import { LedgerEntry } from '../models/ledgerEntry.model.js';
import { Wallet } from '../models/wallet.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { LEDGER_DIRECTION } from '../constants/index.js';

// Who is on each side of a transaction, so admins can read names instead of ids.
const POPULATE_PARTIES = [
    { path: 'source', select: 'reference type owner', populate: { path: 'owner', select: 'name email' } },
    { path: 'destination', select: 'reference type owner', populate: { path: 'owner', select: 'name email' } },
    { path: 'initiatedBy', select: 'name email' },
];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Search accepts three things, all exact or prefix matches so they stay index friendly:
 * a transaction reference (or its start), a wallet reference, or a user's email.
 */
async function searchConditions(search) {
    const conditions = [{ reference: { $regex: `^${escapeRegex(search.toUpperCase())}` } }];

    const [wallet, user] = await Promise.all([
        Wallet.findOne({ reference: search.toUpperCase() }).select('_id'),
        search.includes('@') ? User.findOne({ email: search.toLowerCase() }).select('_id') : null,
    ]);
    if (wallet) conditions.push({ source: wallet._id }, { destination: wallet._id });
    if (user) conditions.push({ initiatedBy: user._id });

    return { $or: conditions };
}

export async function buildTransactionFilter({ search, type, status, currency, from, to }) {
    const conditions = [];
    if (search) conditions.push(await searchConditions(search));
    if (type) conditions.push({ type });
    if (status) conditions.push({ status });
    if (currency) conditions.push({ currency });
    if (from || to) conditions.push({ createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } });
    return conditions.length ? { $and: conditions } : {};
}

export async function listAllTransactions({ page, limit, ...filters }) {
    const filter = await buildTransactionFilter(filters);

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate(POPULATE_PARTIES),
        Transaction.countDocuments(filter),
    ]);

    return { transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Checks the ledger entries of one transaction. Money must be conserved (what leaves
 * equals what arrives) and every entry's balances must add up.
 */
export function checkLedger(entries) {
    const sum = (direction) =>
        entries.filter((entry) => entry.direction === direction).reduce((total, entry) => total + entry.amount, 0);
    const debits = sum(LEDGER_DIRECTION.DEBIT);
    const credits = sum(LEDGER_DIRECTION.CREDIT);

    const entriesAddUp = entries.every((entry) =>
        entry.direction === LEDGER_DIRECTION.CREDIT
            ? entry.balanceAfter === entry.balanceBefore + entry.amount
            : entry.balanceAfter === entry.balanceBefore - entry.amount
    );

    return { debits, credits, balanced: debits === credits, entriesAddUp };
}

export async function getTransactionDetail(reference) {
    const transaction = await Transaction.findOne({ reference }).populate(POPULATE_PARTIES);
    if (!transaction) throw ApiError.notFound('Transaction not found');

    const ledgerEntries = await LedgerEntry.find({ transaction: transaction._id })
        .sort({ createdAt: 1, _id: 1 })
        .populate({ path: 'wallet', select: 'reference type owner', populate: { path: 'owner', select: 'name email' } });

    return { transaction, ledgerEntries, ledgerCheck: checkLedger(ledgerEntries) };
}