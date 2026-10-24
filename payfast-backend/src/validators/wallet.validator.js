import { z } from 'zod';
import { CURRENCIES, DEFAULT_CURRENCY } from '../constants/index.js';

export const createWalletSchema = z.object({
  body: z.object({
    currency: z.nativeEnum(CURRENCIES).default(DEFAULT_CURRENCY),
  }),
});

export const walletIdParamSchema = z.object({
  params: z.object({
    walletId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid wallet id'),
  }),
});
