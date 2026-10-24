const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'wallet_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status = 0, fieldErrors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

const isAuthEndpoint = (path) => path === '/auth/login' || path === '/auth/register';

function buildQuery(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function request(method, path, { body, query, headers = {} } = {}) {
  const token = tokenStorage.get();
  const init = {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
  };
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {}); // the API expects a JSON body even when it is empty
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, init);
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.');
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !isAuthEndpoint(path)) onUnauthorized();
    throw new ApiError(
      payload?.message ?? 'Something went wrong. Please try again.',
      response.status,
      payload?.errors ?? []
    );
  }

  return { data: payload?.data ?? null, message: payload?.message, status: response.status };
}

export const http = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
};
