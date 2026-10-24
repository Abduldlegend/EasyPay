import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.api.js';
import { setUnauthorizedHandler, tokenStorage } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(tokenStorage.get() ? 'loading' : 'anonymous');

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Any expired/invalid token anywhere in the app signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restore the session on page load.
  useEffect(() => {
    if (!tokenStorage.get()) return undefined;
    let cancelled = false;
    authApi
      .getCurrentUser()
      .then(({ user: currentUser }) => {
        if (cancelled) return;
        setUser(currentUser);
        setStatus('authenticated');
      })
      .catch(() => !cancelled && logout());
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const completeAuth = useCallback(({ user: authedUser, token }) => {
    tokenStorage.set(token);
    setUser(authedUser);
    setStatus('authenticated');
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login: async (credentials) => completeAuth(await authApi.login(credentials)),
      register: async (details) => completeAuth(await authApi.register(details)),
      logout,
    }),
    [user, status, completeAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
