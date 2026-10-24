import { Router } from 'express';
import authRoutes from './auth.routes.js';
import walletRoutes from './wallet.routes.js';
import transactionRoutes from './transaction.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, message: 'OK' }));
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/wallets', walletRoutes);
router.use('/transactions', transactionRoutes);

export default router;
