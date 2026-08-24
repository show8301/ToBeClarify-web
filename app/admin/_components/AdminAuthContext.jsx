import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../admin-api.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, error: null });

  const refresh = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const user = await adminApi.getMe(signal);
      setState({ loading: false, user, error: null });
      return user;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      if (error.status === 401) {
        setState({ loading: false, user: null, error: null });
        return null;
      }
      setState({ loading: false, user: null, error });
      throw error;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const user = await adminApi.login(credentials);
    setState({ loading: false, user, error: null });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
    } finally {
      setState({ loading: false, user: null, error: null });
    }
  }, []);

  const value = useMemo(() => ({ ...state, login, logout, refresh }), [login, logout, refresh, state]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error('useAdminAuth must be used inside AdminAuthProvider.');
  return value;
}
