import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { validate } from '../../src/middleware/validate.js';
import { authenticate, authorize } from '../../src/middleware/authenticate.js';
import { ApiError } from '../../src/utils/ApiError.js';
import { signToken } from '../../src/utils/jwt.js';
import { User } from '../../src/models/user.model.js';

vi.mock('../src/models/user.model.js', () => ({ User: { findById: vi.fn() } }));

const mockRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe('errorHandler', () => {
  it('formats ApiError with details', () => {
    const res = mockRes();
    errorHandler(ApiError.badRequest('Validation failed', [{ field: 'a' }]), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'a' }],
    });
  });

  it.each([
    ['duplicate key', { code: 11000 }, 409],
    ['bad ObjectId', { name: 'CastError' }, 400],
    ['malformed JSON', { type: 'entity.parse.failed' }, 400],
  ])('maps %s', (_label, error, status) => {
    const res = mockRes();
    errorHandler(error, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('hides internals for unexpected errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    errorHandler(new Error('db password is hunter2'), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe('Internal server error');
  });
});

describe('validate middleware', () => {
  const schema = z.object({ body: z.object({ email: z.string().email().toLowerCase() }) });

  it('exposes parsed values on req.validated', () => {
    const req = { body: { email: 'A@B.COM' }, query: {}, params: {}, headers: {} };
    const next = vi.fn();
    validate(schema)(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.validated.body.email).toBe('a@b.com');
  });

  it('passes a 400 ApiError with field names on failure', () => {
    const next = vi.fn();
    validate(schema)({ body: { email: 'nope' }, query: {}, params: {}, headers: {} }, {}, next);
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.details[0].field).toBe('email');
  });
});

describe('authenticate / authorize', () => {
  beforeEach(() => vi.clearAllMocks());
  const run = async (headers) => {
    const req = { headers };
    const next = vi.fn();
    await authenticate(req, {}, next);
    return { req, error: next.mock.calls[0]?.[0] };
  };

  it('rejects a missing token', async () => {
    expect((await run({})).error.statusCode).toBe(401);
  });

  it('rejects a garbage token', async () => {
    expect((await run({ authorization: 'Bearer nonsense' })).error.statusCode).toBe(401);
  });

  it('rejects a valid token whose user was deleted', async () => {
    User.findById.mockResolvedValue(null);
    const { error } = await run({ authorization: `Bearer ${signToken({ sub: 'u1' })}` });
    expect(error.statusCode).toBe(401);
  });

  it('attaches the user for a valid token', async () => {
    User.findById.mockResolvedValue({ id: 'u1', role: 'user' });
    const { req, error } = await run({ authorization: `Bearer ${signToken({ sub: 'u1' })}` });
    expect(error).toBeUndefined();
    expect(req.user.id).toBe('u1');
  });

  it('authorize allows listed roles and forbids others', () => {
    const next = vi.fn();
    authorize('admin')({ user: { role: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalledWith();

    const denied = vi.fn();
    authorize('admin')({ user: { role: 'user' } }, {}, denied);
    expect(denied.mock.calls[0][0].statusCode).toBe(403);
  });
});
