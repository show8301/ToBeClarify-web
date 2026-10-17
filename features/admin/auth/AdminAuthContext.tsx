"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { adminApi, adminRequest, ApiError } from "@/features/admin/api/client.js";
import { parseAdminIdentity } from "./identity";
import type { AdminAuthState, AdminAuthValue, AdminIdentity, WorkbenchRole } from "./types";

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("無法確認登入狀態。");
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>({ loading: true, user: null, error: null });
  const account = useRef<AdminIdentity | null>(null);
  const epoch = useRef(0);
  const preferenceQueue = useRef<Promise<unknown>>(Promise.resolve());
  const preferenceRequests = useRef(new Set<AbortController>());

  const invalidateSession = useCallback(() => {
    epoch.current += 1;
    preferenceRequests.current.forEach((controller) => controller.abort());
    preferenceRequests.current.clear();
    preferenceQueue.current = Promise.resolve();
  }, []);

  const applyIdentity = useCallback((identity: AdminIdentity | null) => {
    if (account.current?.id !== identity?.id || account.current?.role !== identity?.role) invalidateSession();
    account.current = identity;
    setState({ loading: false, user: identity, error: null });
  }, [invalidateSession]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const generation = epoch.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const user = parseAdminIdentity(await adminApi.getMe(signal));
      if (signal?.aborted || generation !== epoch.current) return null;
      applyIdentity(user);
      return user;
    } catch (cause) {
      if (signal?.aborted || generation !== epoch.current) return null;
      if (cause instanceof ApiError && cause.status === 401) { applyIdentity(null); return null; }
      invalidateSession();
      account.current = null;
      setState({ loading: false, user: null, error: asError(cause) });
      throw cause;
    }
  }, [applyIdentity, invalidateSession]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void refresh(controller.signal).catch(() => {}); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); invalidateSession(); };
  }, [invalidateSession, refresh]);

  const login = useCallback(async (credentials: { loginName: string; password: string }) => {
    invalidateSession();
    const generation = epoch.current;
    const user = parseAdminIdentity(await adminApi.login(credentials));
    if (generation !== epoch.current) throw new Error("登入狀態已變更，請重新登入。");
    applyIdentity(user);
    return user;
  }, [applyIdentity, invalidateSession]);

  const logout = useCallback(async () => {
    invalidateSession();
    account.current = null;
    setState({ loading: false, user: null, error: null });
    await adminApi.logout();
  }, [invalidateSession]);

  const updateWorkbenchPreference = useCallback((role: WorkbenchRole): Promise<AdminIdentity> => {
    const owner = account.current;
    const generation = epoch.current;
    const save = async () => {
      if (!owner || generation !== epoch.current || account.current?.id !== owner.id) {
        throw new Error("登入狀態已變更，請重新選擇工作台。");
      }
      if (!account.current.availableWorkbenchRoles.includes(role)) throw new Error("此帳號不能使用指定的工作台。");
      const controller = new AbortController();
      preferenceRequests.current.add(controller);
      try {
        const identity = parseAdminIdentity(await adminRequest("/auth/me/preferences", {
          method: "PUT", body: JSON.stringify({ preferredWorkbench: role }), signal: controller.signal,
        }));
        if (controller.signal.aborted || generation !== epoch.current || identity.id !== owner.id) {
          throw new Error("登入狀態已變更，請重新讀取工作台設定。");
        }
        if (identity.preferredWorkbench !== role) throw new Error("無法確認偏好已保存，請重新讀取帳號設定。");
        applyIdentity(identity);
        return identity;
      } finally {
        preferenceRequests.current.delete(controller);
      }
    };
    // Serialize writes so quick switches cannot persist an earlier click last.
    const result = preferenceQueue.current.catch(() => {}).then(save);
    preferenceQueue.current = result;
    return result;
  }, [applyIdentity]);

  const value = useMemo<AdminAuthValue>(() => ({ ...state, login, logout, refresh, updateWorkbenchPreference }),
    [login, logout, refresh, state, updateWorkbenchPreference]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  return value;
}
