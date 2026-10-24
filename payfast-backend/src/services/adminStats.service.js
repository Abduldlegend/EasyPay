import { User } from '../models/user.model.js';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import {
    CURRENCIES,
    TRANSACTION_STATUS,
    TRANSACTION_TYPE,
    USER_ROLES,
    USER_STATUS,
    WALLET_STATUS,
    WALLET_TYPE,
} from '../constants/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const TREND_DAYS = 14;

const emptyCounts = (values) => Object.fromEntries(Object.values(values).map((value) => [value, 0]));

// Turns [{ _id: 'active', count: 3 }] into { active: 3, frozen: 0, ... }.
const countsByKey = (rows, values) => {
    const counts = emptyCounts(values);
    rows.forEach(({ _id, count }) => {
        if (_id in counts) counts[_id] = count;
    });
    return counts;
};

const dayKey = (date) => date.toISOString().slice(0, 10);

/** One entry per day for the last `days` days (UTC), oldest first, zero-filled. */
export function buildDailyTrend(rows, days, now = new Date()) {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const series = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const day = dayKey(new Date(today.getTime() - offset * DAY_MS));
        series.push({ date: day, ...Object.fromEntries(Object.values(CURRENCIES).map((c) => [c, { count: 0, volume: 0 }])) });
    }
    const byDate = new Map(series.map((entry) => [entry.date, entry]));

    rows.forEach(({ _id, count, volume }) => {
        const entry = byDate.get(_id.day);
        if (entry && entry[_id.currency]) entry[_id.currency] = { count, volume };
    });
    return series;
}

export async function getAdminStats(now = new Date()) {
    const since = new Date(now.getTime() - TREND_DAYS * DAY_MS);
    const lastWeek = new Date(now.getTime() - 7 * DAY_MS);
    const userWallets = { type: { $ne: WALLET_TYPE.SYSTEM } };

    const [
        totalUsers,
        disabledUsers,
        adminUsers,
        newUsers,
        walletStatusRows,
        balanceRows,
        transactionStatusRows,
        volumeRows,
        trendRows,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: USER_STATUS.DISABLED }),
        User.countDocuments({ role: USER_ROLES.ADMIN }),
        User.countDocuments({ createdAt: { $gte: lastWeek } }),
        Wallet.aggregate([{ $match: userWallets }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Wallet.aggregate([
            { $match: userWallets },
            { $group: { _id: '$currency', wallets: { $sum: 1 }, totalBalance: { $sum: '$balance' } } },
        ]),
        Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        // Money that actually moved: completed transactions only.
        Transaction.aggregate([
            { $match: { status: TRANSACTION_STATUS.COMPLETED } },
            { $group: { _id: { currency: '$currency', type: '$type' }, count: { $sum: 1 }, volume: { $sum: '$amount' } } },
        ]),
        Transaction.aggregate([
            { $match: { status: TRANSACTION_STATUS.COMPLETED, createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, currency: '$currency' },
                    count: { $sum: 1 },
                    volume: { $sum: '$amount' },
                },
            },
        ]),
    ]);

    const walletsByStatus = countsByKey(walletStatusRows, WALLET_STATUS);

    const currencies = Object.values(CURRENCIES).map((currency) => {
        const balance = balanceRows.find((row) => row._id === currency);
        const volumeByType = Object.fromEntries(
            Object.values(TRANSACTION_TYPE).map((type) => {
                const row = volumeRows.find((r) => r._id.currency === currency && r._id.type === type);
                return [type, { count: row?.count ?? 0, volume: row?.volume ?? 0 }];
            })
        );
        return { currency, wallets: balance?.wallets ?? 0, totalBalance: balance?.totalBalance ?? 0, volumeByType };
    });

    return {
        users: {
            total: totalUsers,
            active: totalUsers - disabledUsers,
            disabled: disabledUsers,
            admins: adminUsers,
            newLast7Days: newUsers,
        },
        wallets: {
            total: Object.values(walletsByStatus).reduce((sum, count) => sum + count, 0),
            byStatus: walletsByStatus,
        },
        transactions: {
            total: transactionStatusRows.reduce((sum, row) => sum + row.count, 0),
            byStatus: countsByKey(transactionStatusRows, TRANSACTION_STATUS),
        },
        currencies,
        // Daily completed volume per currency, for the overview chart.
        trend: buildDailyTrend(trendRows, TREND_DAYS, now),
    };
}