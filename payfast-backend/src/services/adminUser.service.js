import { User } from '../models/user.model.js';
import { Wallet } from '../models/wallet.model.js';
import { Transaction } from '../models/transaction.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { runInTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { AUDIT_ACTION, AUDIT_TARGET, USER_STATUS } from '../constants/index.js';
import { recordAudit } from './audit.service.js';

export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const WALLET_SUMMARY_FIELDS = 'reference currency balance status owner';

export function buildUserFilter({ search, role, status }) {
    const filter = {};
    if (role) filter.role = role;
    if (status === USER_STATUS.DISABLED) filter.status = USER_STATUS.DISABLED;
    // Accounts created before `status` existed have none, and count as active.
    if (status === USER_STATUS.ACTIVE) filter.status = { $ne: USER_STATUS.DISABLED };
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ name: pattern }, { email: pattern }];
    }
    return filter;
}

export async function listUsers({ page, limit, ...filters }) {
    const filter = buildUserFilter(filters);

    const [users, total] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        User.countDocuments(filter),
    ]);

    const wallets = await Wallet.find({ owner: { $in: users.map((user) => user._id) } }).select(WALLET_SUMMARY_FIELDS);
    const byOwner = new Map();
    wallets.forEach((wallet) => {
        const key = String(wallet.owner);
        byOwner.set(key, [...(byOwner.get(key) ?? []), wallet]);
    });

    return {
        users: users.map((user) => ({ ...user.toJSON(), wallets: byOwner.get(String(user._id)) ?? [] })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export async function getUserDetail(userId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const [wallets, recentTransactions, auditLogs] = await Promise.all([
        Wallet.find({ owner: user._id }).sort({ createdAt: 1 }),
        Transaction.find({ initiatedBy: user._id }).sort({ createdAt: -1, _id: -1 }).limit(5),
        AuditLog.find({ targetType: AUDIT_TARGET.USER, targetId: user._id })
            .sort({ createdAt: -1, _id: -1 })
            .limit(10)
            .populate('actor', 'name email'),
    ]);

    return { user, wallets, recentTransactions, auditLogs };
}

/**
 * Disables or re-enables an account. The change and its audit entry commit together.
 *
 * Rules: an admin cannot disable their own account. Because the person acting is always an
 * active admin, this also guarantees at least one active admin always remains.
 */
export async function setUserStatus({ actorId, userId, status, reason }) {
    const disabling = status === USER_STATUS.DISABLED;
    if (disabling && String(actorId) === String(userId)) {
        throw ApiError.unprocessable('You cannot disable your own account');
    }

    let updated;
    await runInTransaction(async (session) => {
        // The status in the filter makes this safe against two admins acting at once.
        const filter = disabling
            ? { _id: userId, status: { $ne: USER_STATUS.DISABLED } }
            : { _id: userId, status: USER_STATUS.DISABLED };
        updated = await User.findOneAndUpdate(filter, { status }, { returnDocument: 'after', session });

        if (!updated) {
            const exists = await User.exists({ _id: userId }).session(session);
            if (!exists) throw ApiError.notFound('User not found');
            throw ApiError.conflict(disabling ? 'This account is already disabled' : 'This account is already active');
        }

        await recordAudit(
            {
                actorId,
                action: disabling ? AUDIT_ACTION.USER_DISABLED : AUDIT_ACTION.USER_ENABLED,
                targetType: AUDIT_TARGET.USER,
                targetId: updated._id,
                reason,
                before: { status: disabling ? USER_STATUS.ACTIVE : USER_STATUS.DISABLED },
                after: { status },
            },
            session
        );
    });

    return updated;
}