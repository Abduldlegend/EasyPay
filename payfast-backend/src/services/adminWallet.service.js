import { Wallet } from '../models/wallet.model.js';
import { User } from '../models/user.model.js';
import { runInTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { AUDIT_ACTION, AUDIT_TARGET, WALLET_STATUS, WALLET_TYPE } from '../constants/index.js';
import { recordAudit } from './audit.service.js';

const POPULATE_OWNER = { path: 'owner', select: 'name email' };

// What each move is called in the audit log, and which starting statuses allow it.
const TRANSITIONS = {
    [WALLET_STATUS.FROZEN]: { action: AUDIT_ACTION.WALLET_FROZEN, from: [WALLET_STATUS.ACTIVE] },
    [WALLET_STATUS.ACTIVE]: { action: AUDIT_ACTION.WALLET_UNFROZEN, from: [WALLET_STATUS.FROZEN] },
    [WALLET_STATUS.CLOSED]: { action: AUDIT_ACTION.WALLET_CLOSED, from: [WALLET_STATUS.ACTIVE, WALLET_STATUS.FROZEN] },
};

/**
 * Decides whether a wallet may move to `target`, or throws why not.
 * Closing is permanent, so it needs a zero balance and nothing can reopen a closed wallet.
 */
export function planWalletChange(wallet, target) {
    if (wallet.type === WALLET_TYPE.SYSTEM) throw ApiError.unprocessable('The settlement wallet cannot be changed');
    if (wallet.status === WALLET_STATUS.CLOSED) throw ApiError.conflict('Closed wallets cannot be changed');
    if (wallet.status === target) throw ApiError.conflict(`Wallet is already ${target}`);

    const transition = TRANSITIONS[target];
    if (!transition.from.includes(wallet.status)) {
        throw ApiError.conflict(`A ${wallet.status} wallet cannot become ${target}`);
    }
    if (target === WALLET_STATUS.CLOSED && wallet.balance !== 0) {
        throw ApiError.unprocessable('Only wallets with a zero balance can be closed');
    }
    return transition;
}

export async function buildWalletFilter({ search, status, currency }) {
    const filter = {};
    if (status) filter.status = status;
    if (currency) filter.currency = currency;
    if (search) {
        const owner = search.includes('@') ? await User.findOne({ email: search.toLowerCase() }).select('_id') : null;
        filter.$or = [{ reference: search.toUpperCase() }, ...(owner ? [{ owner: owner._id }] : [])];
    }
    return filter;
}

export async function listWallets({ page, limit, ...filters }) {
    // The settlement wallet is internal, so it is not listed here.
    const filter = { ...(await buildWalletFilter(filters)), type: { $ne: WALLET_TYPE.SYSTEM } };

    const [wallets, total] = await Promise.all([
        Wallet.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate(POPULATE_OWNER),
        Wallet.countDocuments(filter),
    ]);

    return { wallets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getWalletDetail(walletId) {
    const wallet = await Wallet.findById(walletId).populate(POPULATE_OWNER);
    if (!wallet || wallet.type === WALLET_TYPE.SYSTEM) throw ApiError.notFound('Wallet not found');
    return { wallet };
}

/** Freezes, unfreezes or closes a wallet. The change and its audit entry commit together. */
export async function setWalletStatus({ actorId, walletId, status, reason }) {
    const current = await Wallet.findById(walletId);
    if (!current) throw ApiError.notFound('Wallet not found');
    const { action, from } = planWalletChange(current, status);

    let updated;
    await runInTransaction(async (session) => {
        // Status (and, for closing, a zero balance) are checked again inside the update itself,
        // so a deposit or another admin acting at the same moment cannot slip past the checks above.
        const filter = {
            _id: walletId,
            status: { $in: from },
            ...(status === WALLET_STATUS.CLOSED && { balance: 0 }),
        };
        updated = await Wallet.findOneAndUpdate(filter, { status }, { returnDocument: 'after', session });
        if (!updated) throw ApiError.conflict('The wallet changed while you were working. Reload and try again.');

        await recordAudit(
            {
                actorId,
                action,
                targetType: AUDIT_TARGET.WALLET,
                targetId: updated._id,
                reason,
                before: { status: current.status },
                after: { status },
            },
            session
        );
    });

    return updated.populate(POPULATE_OWNER);
}