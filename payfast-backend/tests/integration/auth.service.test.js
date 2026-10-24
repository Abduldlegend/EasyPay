import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser, registerUser } from '../../src/services/auth.service.js';
import { User } from '../../src/models/user.model.js';
import { verifyToken } from '../../src/utils/jwt.js';

vi.mock('../src/models/user.model.js', () => ({
  User: { exists: vi.fn(), create: vi.fn(), findOne: vi.fn(), findById: vi.fn() },
}));

const fakeUser = (overrides = {}) => ({
  id: 'u1',
  role: 'user',
  comparePassword: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('registerUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the user and returns a signed token', async () => {
    User.exists.mockResolvedValue(null);
    User.create.mockResolvedValue(fakeUser());

    const result = await registerUser({ name: 'Ada', email: 'ada@example.com', password: 'Passw0rdX' });

    expect(User.create).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', password: 'Passw0rdX' });
    expect(verifyToken(result.token)).toMatchObject({ sub: 'u1', role: 'user' });
  });

  it('rejects an email that is already registered', async () => {
    User.exists.mockResolvedValue({ _id: 'x' });
    await expect(registerUser({ email: 'ada@example.com' })).rejects.toMatchObject({ statusCode: 409 });
    expect(User.create).not.toHaveBeenCalled();
  });
});

describe('loginUser', () => {
  beforeEach(() => vi.clearAllMocks());
  const withUser = (user) => User.findOne.mockReturnValue({ select: async () => user });

  it('returns a token for valid credentials', async () => {
    withUser(fakeUser());
    const result = await loginUser({ email: 'ada@example.com', password: 'Passw0rdX' });
    expect(verifyToken(result.token).sub).toBe('u1');
  });

  it('gives the same error for an unknown email and a wrong password', async () => {
    withUser(null);
    const unknown = await loginUser({ email: 'x@example.com', password: 'p' }).catch((e) => e);

    withUser(fakeUser({ comparePassword: vi.fn().mockResolvedValue(false) }));
    const wrong = await loginUser({ email: 'ada@example.com', password: 'bad' }).catch((e) => e);

    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.message).toBe(wrong.message);
  });
});
