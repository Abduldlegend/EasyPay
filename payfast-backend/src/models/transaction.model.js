import mongoose from 'mongoose';
import { CURRENCIES, TRANSACTION_STATUS, TRANSACTION_TYPE } from '../constants/index.js';
import { generateTransactionReference } from '../utils/generateReference.js';

const transactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: generateTransactionReference,
    },
    type: { type: String, enum: Object.values(TRANSACTION_TYPE), required: true, immutable: true },
    amount: { type: Number, required: true, min: 1, immutable: true, validate: Number.isSafeInteger },
    currency: { type: String, enum: Object.values(CURRENCIES), required: true, immutable: true },
    // Wallet the money leaves / arrives in. For deposits the source is the settlement wallet.
    source: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', immutable: true },
    destination: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', immutable: true },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING,
    },
    description: { type: String, trim: true, maxlength: 140 },
    failureReason: { type: String },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    idempotencyKey: { type: String, immutable: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// A client-supplied idempotency key may only be used once per user.
transactionSchema.index(
  { initiatedBy: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
transactionSchema.index({ initiatedBy: 1, createdAt: -1 });
transactionSchema.index({ source: 1, createdAt: -1 });
transactionSchema.index({ destination: 1, createdAt: -1 });

transactionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Transaction = mongoose.model('Transaction', transactionSchema);
