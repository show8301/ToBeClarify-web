"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type AdminToolbarValue = {
  refreshTarget: HTMLDivElement | null;
  setRefreshTarget: (target: HTMLDivElement | null) => void;
};

const AdminToolbarContext = createContext<AdminToolbarValue | null>(null);

export function AdminToolbarProvider({ children }: { children: ReactNode }) {
  const [refreshTarget, setRefreshTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ refreshTarget, setRefreshTarget }), [refreshTarget]);

  return <AdminToolbarContext.Provider value={value}>{children}</AdminToolbarContext.Provider>;
}

export function AdminToolbarRefreshSlot() {
  const toolbar = useContext(AdminToolbarContext);
  return <div className="adminToolbarRefreshSlot" ref={toolbar?.setRefreshTarget} />;
}

export function useAdminToolbarRefreshTarget() {
  return useContext(AdminToolbarContext)?.refreshTarget ?? null;
}
