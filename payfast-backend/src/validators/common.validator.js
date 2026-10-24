import { z } from 'zod';
import { MAX_SINGLE_TRANSACTION_AMOUNT } from '../constants/index.js';

export const objectIdSchema = (label = 'id') =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label}`);

/** Whole number of minor units (kobo / cents). Floats are rejected on purpose. */
export const amountSchema = z
  .number({ invalid_type_error: 'Amount must be a number', required_error: 'Amount is required' })
  .int('Amount must be a whole number of minor units (e.g. kobo)')
  .positive('Amount must be greater than zero')
  .max(MAX_SINGLE_TRANSACTION_AMOUNT, 'Amount exceeds the maximum allowed per transaction');

export const descriptionSchema = z.string().trim().max(140, 'Description is too long').optional();

export const idempotencyHeaderSchema = z.object({
  'idempotency-key': z.string().trim().min(8).max(64).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
