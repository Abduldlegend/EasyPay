import { User } from '../models/user.model.js';
import { AUDIT_ACTION, AUDIT_TARGET, USER_ROLES, USER_STATUS } from '../constants/index.js';
import { recordAudit } from './audit.service.js';

/**
 * Makes sure an admin account exists for this email. Used by the create-admin script,
 * because registration through the API can never grant the admin role.
 *
 * Returns { user, outcome } where outcome is 'created', 'promoted' or 'unchanged'.
 */
export async function ensureAdminUser({ name, email, password }) {
    const existing = await User.findOne({ email });

    if (existing?.role === USER_ROLES.ADMIN && existing.status !== USER_STATUS.DISABLED) {
        return { user: existing, outcome: 'unchanged' };
    }

    let user;
    let outcome;
    if (existing) {
        existing.role = USER_ROLES.ADMIN;
        existing.status = USER_STATUS.ACTIVE;
        user = await existing.save();
        outcome = 'promoted';
    } else {
        user = await User.create({ name, email, password, role: USER_ROLES.ADMIN });
        outcome = 'created';
    }

    await recordAudit({
        actorId: user._id,
        action: AUDIT_ACTION.ADMIN_CREATED,
        targetType: AUDIT_TARGET.USER,
        targetId: user._id,
        reason: `Admin ${outcome} with the create-admin script`,
        after: { role: user.role, status: user.status },
    });

    return { user, outcome };
}