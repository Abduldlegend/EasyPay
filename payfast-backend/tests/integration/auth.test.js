import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { registerSchema, loginSchema } from '../../src/validators/auth.validator.js';
import { signToken, verifyToken } from '../../src/utils/jwt.js';

const app = createApp();

describe('auth validators', () => {
  const valid = { name: 'Ada Obi', email: ' ADA@Example.com ', password: 'Passw0rdX' };

  it('accepts valid registration and normalises email', () => {
    const result = registerSchema.safeParse({ body: valid });
    expect(result.success).toBe(true);
    expect(result.data.body.email).toBe('ada@example.com');
  });

  it.each([
    ['short password', { ...valid, password: 'Ab1' }],
    ['no uppercase', { ...valid, password: 'password1' }],
    ['no number', { ...valid, password: 'Passwordx' }],
    ['bad email', { ...valid, email: 'not-an-email' }],
    ['short name', { ...valid, name: 'A' }],
  ])('rejects %s', (_label, body) => {
    expect(registerSchema.safeParse({ body }).success).toBe(false);
  });

  it('requires a password on login', () => {
    expect(loginSchema.safeParse({ body: { email: 'a@b.com', password: '' } }).success).toBe(false);
  });
});

describe('jwt utils', () => {
  it('round-trips a payload', () => {
    const token = signToken({ sub: 'abc', role: 'user' });
    expect(verifyToken(token)).toMatchObject({ sub: 'abc', role: 'user' });
  });

  it('rejects a tampered token', () => {
    expect(() => verifyToken(`${signToken({ sub: 'abc' })}x`)).toThrow();
  });
});

describe('http layer (no database needed)', () => {
  it('returns health status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });

  it('returns 400 with field errors for invalid registration', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('returns 401 for /auth/me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
  });
});
