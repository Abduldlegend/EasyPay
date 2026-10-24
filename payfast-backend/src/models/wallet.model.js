import mongoose from 'mongoose';
import { CURRENCIES, WALLET_STATUS, WALLET_TYPE } from '../constants/index.js';
import { generateWalletReference } from '../utils/generateReference.js';

const walletSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: generateWalletReference,
    },
    type: {
      type: String,
      enum: Object.values(WALLET_TYPE),
      default: WALLET_TYPE.USER,
      immutable: true,
    },
    // System wallets (e.g. settlement) have no owner.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      immutable: true,
      required: function ownerRequired() {
        return this.type !== WALLET_TYPE.SYSTEM;
      },
    },
    currency: {
      type: String,
      enum: Object.values(CURRENCIES),
      required: true,
      immutable: true,
    },
    // Integer minor units (kobo / cents) to avoid floating point errors.
    balance: {
      type: Number,
      default: 0,
      validate: [
        {
          validator: Number.isSafeInteger,
          message: 'Balance must be a whole number of minor units',
        },
        {
          // User wallets can never go negative. The settlement wallet goes negative
          // by exactly the amount of money in circulation, so total balance stays 0.
          validator: function nonNegativeForUsers(value) {
            return this.type === WALLET_TYPE.SYSTEM || value >= 0;
          },
          message: 'Balance cannot be negative',
        },
      ],
    },
    status: {
      type: String,
      enum: Object.values(WALLET_STATUS),
      default: WALLET_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

// One wallet per currency per owner (and one system wallet per currency).
walletSchema.index({ owner: 1, currency: 1 }, { unique: true });

walletSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Wallet = mongoose.model('Wallet', walletSchema);
