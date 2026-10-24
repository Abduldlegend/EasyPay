import { Router } from 'express';
import * as walletController from '../controllers/wallet.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createWalletSchema, walletIdParamSchema } from '../validators/wallet.validator.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createWalletSchema), walletController.createWallet);
router.get('/', walletController.listMyWallets);
router.get('/:walletId', validate(walletIdParamSchema), walletController.getMyWallet);

export default router;
