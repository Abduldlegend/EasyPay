import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as adminStatsService from '../services/adminStats.service.js';
import * as auditService from '../services/audit.service.js';
import * as adminTransactionService from '../services/adminTransaction.service.js';
import * as adminUserService from '../services/adminUser.service.js';
import * as adminWalletService from '../services/adminWallet.service.js';


export const listAuditLogs = asyncHandler(async (req, res) => {
    const result = await auditService.listAuditLogs(req.validated.query);
    sendSuccess(res, { data: result });
});

export const getStats = asyncHandler(async (_req, res) => {
    const stats = await adminStatsService.getAdminStats();
    sendSuccess(res, { data: { stats } });
});

export const listTransactions = asyncHandler(async (req, res) => {
    const result = await adminTransactionService.listAllTransactions(req.validated.query);
    sendSuccess(res, { data: result });
});

export const getTransaction = asyncHandler(async (req, res) => {
    const result = await adminTransactionService.getTransactionDetail(req.validated.params.reference);
    sendSuccess(res, { data: result });
});

export const listUsers = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await adminUserService.listUsers(req.validated.query) });
});

export const getUser = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await adminUserService.getUserDetail(req.validated.params.userId) });
});

export const setUserStatus = asyncHandler(async (req, res) => {
    const user = await adminUserService.setUserStatus({
        actorId: req.user.id,
        userId: req.validated.params.userId,
        ...req.validated.body,
    });
    sendSuccess(res, { message: `User ${user.status}`, data: { user } });
});

export const listWallets = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await adminWalletService.listWallets(req.validated.query) });
});

export const getWallet = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: await adminWalletService.getWalletDetail(req.validated.params.walletId) });
});

export const setWalletStatus = asyncHandler(async (req, res) => {
    const wallet = await adminWalletService.setWalletStatus({
        actorId: req.user.id,
        walletId: req.validated.params.walletId,
        ...req.validated.body,
    });
    sendSuccess(res, { message: `Wallet ${wallet.status}`, data: { wallet } });
});