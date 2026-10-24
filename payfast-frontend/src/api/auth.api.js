import { http } from './client.js';

export const register = async (values) => (await http.post('/auth/register', values)).data;
export const login = async (values) => (await http.post('/auth/login', values)).data;
export const getCurrentUser = async () => (await http.get('/auth/me')).data;
