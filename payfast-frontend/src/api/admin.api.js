import { http } from './client.js';

export const listAuditLogs = async ({ page = 1, limit = 20, action, targetType } = {}) =>
    (await http.get('/admin/audit-logs', { query: { page, limit, action, targetType } })).data;

export const getAdminStats = async () => (await http.get('/admin/stats')).data.stats;

export const listAdminTransactions = async ({ page = 1, limit = 20, search, type, status, currency, from, to } = {}) =>
    (await http.get('/admin/transactions', { query: { page, limit, search, type, status, currency, from, to } })).data;

export const getAdminTransaction = async (reference) => (await http.get(`/admin/transactions/${reference}`)).data;
