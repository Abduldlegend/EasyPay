import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  adminTransactionsQuerySchema,
  adminUserParamSchema,
  adminUsersQuerySchema,
  adminWalletParamSchema,
  adminWalletsQuerySchema,
  auditLogsQuerySchema,
  setUserStatusSchema,
  setWalletStatusSchema,
} from '../validators/admin.validator.js';
import { transactionReferenceParamSchema } from '../validators/transaction.validator.js';

const router = Router();

// Everything under /admin: rate limit first, then must be a signed-in admin.
router.use(adminLimiter, authenticate, requireAdmin);

router.get('/stats', adminController.getStats);

router.get('/users', validate(adminUsersQuerySchema), adminController.listUsers);
router.get('/users/:userId', validate(adminUserParamSchema), adminController.getUser);
router.patch('/users/:userId/status', validate(setUserStatusSchema), adminController.setUserStatus);

router.get('/wallets', validate(adminWalletsQuerySchema), adminController.listWallets);
router.get('/wallets/:walletId', validate(adminWalletParamSchema), adminController.getWallet);
router.patch('/wallets/:walletId/status', validate(setWalletStatusSchema), adminController.setWalletStatus);

router.get('/transactions', validate(adminTransactionsQuerySchema), adminController.listTransactions);
router.get('/transactions/:reference', validate(transactionReferenceParamSchema), adminController.getTransaction);

router.get('/audit-logs', validate(auditLogsQuerySchema), adminController.listAuditLogs);

export default router;