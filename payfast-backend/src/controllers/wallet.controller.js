import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as walletService from '../services/wallet.service.js';

export const createWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.createWallet(req.user.id, req.body.currency);
  sendSuccess(res, { statusCode: 201, message: 'Wallet created', data: { wallet } });
});

export const listMyWallets = asyncHandler(async (req, res) => {
  const wallets = await walletService.listWalletsForUser(req.user.id);
  sendSuccess(res, { data: { wallets } });
});

export const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.getWalletForUser(req.params.walletId, req.user.id);
  sendSuccess(res, { data: { wallet } });
});
