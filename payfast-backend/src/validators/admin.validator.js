import { z } from 'zod';
import { AUDIT_ACTION, AUDIT_TARGET, CURRENCIES, TRANSACTION_STATUS, TRANSACTION_TYPE, USER_ROLES,
  USER_STATUS,
  WALLET_STATUS } from '../constants/index.js';
import { paginationQuerySchema } from './common.validator.js';
import { dateFilter } from './transaction.validator.js';


export const auditLogsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    action: z.nativeEnum(AUDIT_ACTION).optional(),
    targetType: z.nativeEnum(AUDIT_TARGET).optional(),
  }),
});

export const adminTransactionsQuerySchema = z.object({
  query: paginationQuerySchema
    .extend({
      // A transaction reference (or the start of one), a wallet reference, or a user's email.
      search: z.string().trim().min(1).max(100).optional(),
      type: z.nativeEnum(TRANSACTION_TYPE).optional(),
      status: z.nativeEnum(TRANSACTION_STATUS).optional(),
      currency: z.nativeEnum(CURRENCIES).optional(),
      from: dateFilter(),
      to: dateFilter({ endOfDay: true }),
    })
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
      message: '"from" must be before "to"',
      path: ['to'],
    }),
});

const reasonSchema = z.string().trim().min(5, 'Please give a reason (at least 5 characters)').max(500);

const userIdParams = z.object({ userId: objectIdSchema('user id') });
const walletIdParams = z.object({ walletId: objectIdSchema('wallet id') });

export const adminUsersQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(100).optional(),
    role: z.nativeEnum(USER_ROLES).optional(),
    status: z.nativeEnum(USER_STATUS).optional(),
  }),
});

export const adminUserParamSchema = z.object({ params: userIdParams });

export const setUserStatusSchema = z.object({
  params: userIdParams,
  body: z
    .object({ status: z.nativeEnum(USER_STATUS), reason: reasonSchema.optional() })
    // Restricting someone needs an explanation; restoring them does not.
    .refine((body) => body.status !== USER_STATUS.DISABLED || body.reason, {
      message: 'A reason is required to disable an account',
      path: ['reason'],
    }),
});

export const adminWalletsQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    // A wallet reference, or the exact email of its owner.
    search: z.string().trim().min(1).max(100).optional(),
    status: z.nativeEnum(WALLET_STATUS).optional(),
    currency: z.nativeEnum(CURRENCIES).optional(),
  }),
});

export const adminWalletParamSchema = z.object({ params: walletIdParams });

export const setWalletStatusSchema = z.object({
  params: walletIdParams,
  body: z
    .object({ status: z.nativeEnum(WALLET_STATUS), reason: reasonSchema.optional() })
    .refine((body) => body.status === WALLET_STATUS.ACTIVE || body.reason, {
      message: 'A reason is required to freeze or close a wallet',
      path: ['reason'],
    }),
});
