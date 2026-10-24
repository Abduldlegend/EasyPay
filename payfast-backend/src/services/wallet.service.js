import { Wallet } from '../models/wallet.model.js';
import { ApiError } from '../utils/ApiError.js';
import { WALLET_TYPE } from '../constants/index.js';

export async function createWallet(ownerId, currency) {
  try {
    return await Wallet.create({ owner: ownerId, currency });
  } catch (error) {
    // The unique (owner, currency) index makes this race-safe without a pre-check.
    if (error.code === 11000 && error.keyPattern?.owner) {
      throw ApiError.conflict(`You already have a ${currency} wallet`);
    }
    throw error;
  }
}

export function listWalletsForUser(ownerId) {
  return Wallet.find({ owner: ownerId }).sort({ createdAt: -1 });
}

/**
 * Ownership is enforced in the query itself. A wallet that belongs to someone
 * else is reported as "not found" so its existence is not leaked.
 */
export async function getWalletForUser(walletId, ownerId) {
  const wallet = await Wallet.findOne({ _id: walletId, owner: ownerId });
  if (!wallet) throw ApiError.notFound('Wallet not found');
  return wallet;
}

/** Internal counterparty that funds deposits (and receives withdrawals). Created on first use. */
export async function getSettlementWallet(currency) {
  const filter = { type: WALLET_TYPE.SYSTEM, currency };
  const existing = await Wallet.findOne(filter);
  if (existing) return existing;

  try {
    return await Wallet.create(filter);
  } catch (error) {
    if (error.code === 11000) return Wallet.findOne(filter); // created by a concurrent request
    throw error;
  }
}

/** Looks up another user's wallet by its public reference (e.g. WLT-9F3A1C07B2) for transfers. */
export function findUserWalletByReference(reference) {
  return Wallet.findOne({ reference, type: WALLET_TYPE.USER });
}

export function getWalletIdsForUser(ownerId) {
  return Wallet.distinct('_id', { owner: ownerId });
}
