import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http, setUnauthorizedHandler, tokenStorage } from './client.js';
import { deposit } from './transactions.api.js';
import { isOutcomeUnknown } from '../utils/errors.js';

const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });

let storage;
beforeEach(() => {
  storage = {};
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
  });
  vi.stubGlobal('fetch', vi.fn());
  setUnauthorizedHandler(() => {});
});

describe('http client', () => {
  it('always sends a JSON body on POST, even an empty one', async () => {
    fetch.mockResolvedValue(jsonResponse(201, { success: true, data: {} }));
    await http.post('/wallets');

    const [, init] = fetch.mock.calls[0];
    expect(init.body).toBe('{}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('attaches the bearer token when logged in', async () => {
    tokenStorage.set('abc');
    fetch.mockResolvedValue(jsonResponse(200, { data: { wallets: [] } }));
    await http.get('/wallets');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  it('drops empty query values', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { data: {} }));
    await http.get('/transactions', { query: { page: 2, type: '', status: undefined, walletId: 'w1' } });
    expect(fetch.mock.calls[0][0]).toMatch(/\/transactions\?page=2&walletId=w1$/);
  });

  it('turns API errors into ApiError with field errors', async () => {
    fetch.mockResolvedValue(
      jsonResponse(400, { success: false, message: 'Validation failed', errors: [{ field: 'amount', message: 'bad' }] })
    );
    const error = await http.post('/x', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'Validation failed', fieldErrors: [{ field: 'amount', message: 'bad' }] });
  });

  it('signs the user out on 401 except for login/register', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetch.mockResolvedValue(jsonResponse(401, { message: 'Invalid or expired token' }));

    await http.get('/wallets').catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await http.post('/auth/login', {}).catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports network failures as outcome-unknown', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await http.get('/wallets').catch((e) => e);
    expect(error.status).toBe(0);
    expect(isOutcomeUnknown(error)).toBe(true);
    expect(isOutcomeUnknown(new ApiError('nope', 422))).toBe(false);
    expect(isOutcomeUnknown(new ApiError('boom', 500))).toBe(true);
  });
});

describe('transactions api', () => {
  it('sends the Idempotency-Key header and flags replays', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { data: { transaction: { reference: 'TXN-1', status: 'completed' } } }));

    const result = await deposit({ walletId: 'w1', amount: 5000, idempotencyKey: 'key-123' });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/transactions\/deposits$/);
    expect(init.headers['Idempotency-Key']).toBe('key-123');
    expect(JSON.parse(init.body)).toEqual({ walletId: 'w1', amount: 5000 });
    expect(result).toEqual({ transaction: { reference: 'TXN-1', status: 'completed' }, replayed: true });
  });
});
