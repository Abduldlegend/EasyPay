import mongoose from 'mongoose';
import { CURRENCIES, LEDGER_DIRECTION } from '../constants/index.js';

const immutable = true;

const ledgerEntrySchema = new mongoose.Schema(
  {
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true, immutable },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, immutable },
    direction: { type: String, enum: Object.values(LEDGER_DIRECTION), required: true, immutable },
    amount: { type: Number, required: true, min: 1, immutable, validate: Number.isSafeInteger },
    currency: { type: String, enum: Object.values(CURRENCIES), required: true, immutable },
    balanceBefore: { type: Number, required: true, immutable },
    balanceAfter: { type: Number, required: true, immutable },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ledgerEntrySchema.index({ wallet: 1, createdAt: -1 });
ledgerEntrySchema.index({ transaction: 1 });

// The ledger is append-only: corrections are made with new entries (reversals), never edits.
const forbid = () => {
  throw new Error('Ledger entries are immutable');
};
ledgerEntrySchema.pre('save', function blockResave() {
  if (!this.isNew) forbid();
});
['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne',
  'deleteOne', 'deleteMany', 'findOneAndDelete'].forEach((operation) =>
  ledgerEntrySchema.pre(operation, forbid)
);

ledgerEntrySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
