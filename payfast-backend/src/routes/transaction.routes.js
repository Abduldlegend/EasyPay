import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import {
  depositSchema,
  listTransactionsSchema,
  transactionReferenceParamSchema,
  transferSchema,
  withdrawalSchema,
} from '../validators/transaction.validator.js';

const router = Router();

router.use(authenticate);

router.post('/deposits', validate(depositSchema), transactionController.createDeposit);
router.post('/withdrawals', validate(withdrawalSchema), transactionController.createWithdrawal);
router.post('/transfers', validate(transferSchema), transactionController.createTransfer);
router.get('/', validate(listTransactionsSchema), transactionController.listTransactions);
router.get(
  '/:reference',
  validate(transactionReferenceParamSchema),
  transactionController.getTransaction
);

export default router;
