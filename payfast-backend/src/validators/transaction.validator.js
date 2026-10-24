import { z } from 'zod';
import { TRANSACTION_STATUS, TRANSACTION_TYPE } from '../constants/index.js';
import {
  amountSchema,
  descriptionSchema,
  idempotencyHeaderSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.validator.js';

const walletMoneyRequestSchema = z.object({
  body: z.object({
    walletId: objectIdSchema('wallet id'),
    amount: amountSchema,
    description: descriptionSchema,
  }),
  headers: idempotencyHeaderSchema,
});

export const depositSchema = walletMoneyRequestSchema;
export const withdrawalSchema = walletMoneyRequestSchema;

export const transferSchema = z.object({
  body: z.object({
    sourceWalletId: objectIdSchema('source wallet id'),
    destinationWalletReference: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^WLT-[0-9A-F]{10}$/, 'Invalid destination wallet reference'),
    amount: amountSchema,
    description: descriptionSchema,
  }),
  headers: idempotencyHeaderSchema,
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** ISO date or datetime. A date-only upper bound (to=2026-10-05) includes that whole day. */
export const dateFilter = ({ endOfDay = false } = {}) =>
  z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
    .transform((value) => {
      const date = new Date(value);
      if (endOfDay && DATE_ONLY.test(value)) date.setUTCHours(23, 59, 59, 999);
      return date;
    })
    .optional();

export const listTransactionsSchema = z.object({
  query: paginationQuerySchema
    .extend({
      walletId: objectIdSchema('wallet id').optional(),
      type: z.nativeEnum(TRANSACTION_TYPE).optional(),
      status: z.nativeEnum(TRANSACTION_STATUS).optional(),
      from: dateFilter(),
      to: dateFilter({ endOfDay: true }),
    })
    .refine((query) => !query.from || !query.to || query.from <= query.to, {
      message: '"from" must be before "to"',
      path: ['to'],
    }),
});

export const transactionReferenceParamSchema = z.object({
  params: z.object({
    reference: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^TXN-[0-9A-F]{10}$/, 'Invalid transaction reference'),
  }),
});
