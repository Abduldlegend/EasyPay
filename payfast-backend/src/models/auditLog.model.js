import mongoose from 'mongoose';
import { AUDIT_ACTION, AUDIT_TARGET } from '../constants/index.js';

const immutable = true;

const auditLogSchema = new mongoose.Schema(
    {
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable },
        action: { type: String, enum: Object.values(AUDIT_ACTION), required: true, immutable },
        targetType: { type: String, enum: Object.values(AUDIT_TARGET), required: true, immutable },
        targetId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable },
        // Why the admin did it. Required for anything that restricts a user or wallet.
        reason: { type: String, trim: true, maxlength: 500, immutable },
        before: { type: mongoose.Schema.Types.Mixed, immutable },
        after: { type: mongoose.Schema.Types.Mixed, immutable },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

// Append-only, like the ledger: history is never edited or removed.
const forbid = () => {
    throw new Error('Audit log entries are immutable');
};
auditLogSchema.pre('save', function blockResave() {
    if (!this.isNew) forbid();
});
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne',
    'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach((operation) =>
        auditLogSchema.pre(operation, forbid)
    );

auditLogSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
    },
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);