import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createWalletSchema, walletIdParamSchema } from '../../src/validators/wallet.validator.js';
import { generateWalletReference } from '../../src/utils/generateReference.js';
import * as walletService from '../../src/services/wallet.service.js';
import { Wallet } from '../../src/models/wallet.model.js';

vi.mock('../src/models/wallet.model.js', () => ({
  Wallet: { create: vi.fn(), find: vi.fn(), findOne: vi.fn() },
}));

describe('wallet validators', () => {
  it('defaults currency to NGN', () => {
    const result = createWalletSchema.safeParse({ body: {} });
    expect(result.data.body.currency).toBe('NGN');
  });

  it('rejects unsupported currencies', () => {
    expect(createWalletSchema.safeParse({ body: { currency: 'XYZ' } }).success).toBe(false);
  });

  it('rejects malformed wallet ids', () => {
    expect(walletIdParamSchema.safeParse({ params: { walletId: 'abc' } }).success).toBe(false);
    expect(walletIdParamSchema.safeParse({ params: { walletId: 'a'.repeat(24) } }).success).toBe(true);
  });
});

describe('generateWalletReference', () => {
  it('produces unique prefixed references', () => {
    const [a, b] = [generateWalletReference(), generateWalletReference()];
    expect(a).toMatch(/^WLT-[0-9A-F]{10}$/);
    expect(a).not.toBe(b);
  });
});

describe('wallet service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('translates a duplicate (owner, currency) into a conflict', async () => {
    Wallet.create.mockRejectedValue({ code: 11000, keyPattern: { owner: 1, currency: 1 } });
    await expect(walletService.createWallet('u1', 'NGN')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rethrows unrelated errors', async () => {
    Wallet.create.mockRejectedValue(new Error('boom'));
    await expect(walletService.createWallet('u1', 'NGN')).rejects.toThrow('boom');
  });

  it('scopes wallet lookup to the owner and returns 404 when not theirs', async () => {
    Wallet.findOne.mockResolvedValue(null);
    await expect(walletService.getWalletForUser('w1', 'u1')).rejects.toMatchObject({ statusCode: 404 });
    expect(Wallet.findOne).toHaveBeenCalledWith({ _id: 'w1', owner: 'u1' });
  });
});

describe('wallet routes', () => {
  const app = createApp();

  it.each([
    ['post', '/api/v1/wallets'],
    ['get', '/api/v1/wallets'],
    ['get', `/api/v1/wallets/${'a'.repeat(24)}`],
  ])('%s %s requires authentication', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});
