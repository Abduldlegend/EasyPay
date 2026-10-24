import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { authenticate } from '../../src/middleware/authenticate.js';
import { loginUser } from '../../src/services/auth.service.js';
import { ensureAdminUser } from '../../src/services/admin.service.js';
import { listAuditLogs, recordAudit } from '../../src/services/audit.service.js';
import { auditLogsQuerySchema } from '../../src/validators/admin.validator.js';
import { signToken } from '../../src/utils/jwt.js';
import { User } from '../../src/models/user.model.js';
import { AuditLog } from '../../src/models/auditLog.model.js';

vi.mock('../src/models/user.model.js', () => ({
    User: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn(), exists: vi.fn() },
}));
vi.mock('../src/models/auditLog.model.js', () => ({
    AuditLog: { create: vi.fn(), find: vi.fn(), countDocuments: vi.fn() },
}));

const app = createApp();
const bearer = (role = 'user') => `Bearer ${signToken({ sub: 'u1', role })}`;
const dbUser = (overrides = {}) => ({ id: 'u1', _id: 'u1', role: 'user', status: 'active', ...overrides });

beforeEach(() => vi.clearAllMocks());

describe('disabled accounts', () => {
    it('are rejected by authenticate with 401 so the frontend signs them out', async () => {
        User.findById.mockResolvedValue(dbUser({ status: 'disabled' }));
        const req = { headers: { authorization: bearer() } };
        const next = vi.fn();
        await authenticate(req, {}, next);
        expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, message: 'This account has been disabled' });
    });

    it('still let through accounts with no status field (created before it existed)', async () => {
        User.findById.mockResolvedValue(dbUser({ status: undefined }));
        const req = { headers: { authorization: bearer() } };
        const next = vi.fn();
        await authenticate(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        expect(req.user.id).toBe('u1');
    });

    it('cannot log in, but only after proving the password', async () => {
        const withUser = (user) => User.findOne.mockReturnValue({ select: async () => user });

        withUser(dbUser({ status: 'disabled', comparePassword: vi.fn().mockResolvedValue(true) }));
        await expect(loginUser({ email: 'a@b.com', password: 'Passw0rdX' })).rejects.toMatchObject({ statusCode: 403 });

        withUser(dbUser({ status: 'disabled', comparePassword: vi.fn().mockResolvedValue(false) }));
        await expect(loginUser({ email: 'a@b.com', password: 'wrong' })).rejects.toMatchObject({
            statusCode: 401,
            message: 'Invalid email or password',
        });
    });
});

describe('GET /api/v1/admin/audit-logs access control', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/v1/admin/audit-logs');
        expect(res.status).toBe(401);
    });

    it('returns 403 for a normal user', async () => {
        User.findById.mockResolvedValue(dbUser());
        const res = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', bearer());
        expect(res.status).toBe(403);
        expect(AuditLog.find).not.toHaveBeenCalled();
    });

    it('returns 403 when the token says admin but the database says user (demoted)', async () => {
        User.findById.mockResolvedValue(dbUser({ role: 'user' }));
        const res = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', bearer('admin'));
        expect(res.status).toBe(403);
    });

    it('returns the page for an admin', async () => {
        User.findById.mockResolvedValue(dbUser({ role: 'admin' }));
        const chain = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), populate: vi.fn().mockResolvedValue([{ action: 'admin.created' }]) };
        AuditLog.find.mockReturnValue(chain);
        AuditLog.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/v1/admin/audit-logs?limit=5').set('Authorization', bearer('admin'));

        expect(res.status).toBe(200);
        expect(res.body.data.pagination).toEqual({ page: 1, limit: 5, total: 1, totalPages: 1 });
        expect(res.body.data.auditLogs).toHaveLength(1);
    });

    it('rejects an unknown action filter with 400', async () => {
        User.findById.mockResolvedValue(dbUser({ role: 'admin' }));
        const res = await request(app).get('/api/v1/admin/audit-logs?action=nope').set('Authorization', bearer('admin'));
        expect(res.status).toBe(400);
    });
});

describe('audit service', () => {
    it('recordAudit passes the session so the entry joins the caller transaction', async () => {
        AuditLog.create.mockResolvedValue([{ id: 'a1' }]);
        const session = { id: 's' };
        const entry = await recordAudit({ actorId: 'u1', action: 'user.disabled', targetType: 'user', targetId: 't1', reason: 'fraud' }, session);
        expect(entry).toEqual({ id: 'a1' });
        expect(AuditLog.create).toHaveBeenCalledWith([expect.objectContaining({ actor: 'u1', reason: 'fraud' })], { session });
    });

    it('listAuditLogs filters, paginates and computes totalPages', async () => {
        const chain = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), populate: vi.fn().mockResolvedValue([]) };
        AuditLog.find.mockReturnValue(chain);
        AuditLog.countDocuments.mockResolvedValue(45);

        const result = await listAuditLogs({ page: 3, limit: 20, action: 'wallet.frozen' });

        expect(AuditLog.find).toHaveBeenCalledWith({ action: 'wallet.frozen' });
        expect(chain.skip).toHaveBeenCalledWith(40);
        expect(result.pagination.totalPages).toBe(3);
    });

    it('validator applies pagination defaults', () => {
        const parsed = auditLogsQuerySchema.parse({ query: {} });
        expect(parsed.query).toMatchObject({ page: 1, limit: 20 });
    });
});

describe('ensureAdminUser', () => {
    const input = { name: 'Ada Admin', email: 'ada@example.com', password: 'Passw0rdX' };

    it('creates a new admin and audits it', async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: 'n1', role: 'admin', status: 'active', email: input.email });
        AuditLog.create.mockResolvedValue([{}]);

        const { outcome } = await ensureAdminUser(input);

        expect(outcome).toBe('created');
        expect(User.create).toHaveBeenCalledWith({ ...input, role: 'admin' });
        expect(AuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('promotes an existing user without touching their password', async () => {
        const existing = { _id: 'e1', role: 'user', status: 'disabled', save: vi.fn().mockImplementation(async function () { return this; }) };
        User.findOne.mockResolvedValue(existing);
        AuditLog.create.mockResolvedValue([{}]);

        const { outcome, user } = await ensureAdminUser(input);

        expect(outcome).toBe('promoted');
        expect(user).toMatchObject({ role: 'admin', status: 'active' });
        expect(User.create).not.toHaveBeenCalled();
    });

    it('does nothing for an account that is already an active admin', async () => {
        User.findOne.mockResolvedValue({ _id: 'e1', role: 'admin', status: 'active' });
        const { outcome } = await ensureAdminUser(input);
        expect(outcome).toBe('unchanged');
        expect(AuditLog.create).not.toHaveBeenCalled();
    });
});