import { AuditLog } from '../models/auditLog.model.js';

/**
 * Records one admin action. Pass the database `session` when the action itself runs in a
 * transaction, so the action and its audit entry commit together or not at all.
 */
export async function recordAudit({ actorId, action, targetType, targetId, reason, before, after }, session) {
    const [entry] = await AuditLog.create(
        [{ actor: actorId, action, targetType, targetId, reason, before, after }],
        { session }
    );
    return entry;
}

export async function listAuditLogs({ page, limit, action, targetType }) {
    const filter = {
        ...(action && { action }),
        ...(targetType && { targetType }),
    };

    const [auditLogs, total] = await Promise.all([
        AuditLog.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('actor', 'name email'),
        AuditLog.countDocuments(filter),
    ]);

    return { auditLogs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}