import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext";
import { isWorkbenchRole } from "@/features/admin/auth/identity";
import type { WorkbenchRole } from "@/features/admin/auth/types";

type Choice = { owner: string; query: string; role: WorkbenchRole };
type SaveState = { owner: string; pending: boolean; error: string };
const noRoles: WorkbenchRole[] = [];

export function useWorkbenchPreference() {
  const { user, updateWorkbenchPreference } = useAdminAuth();
  const query = useSearchParams().get("workbench") || "";
  const [choice, setChoice] = useState<Choice | null>(null);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const sequence = useRef(0);
  const availableRoles = user?.availableWorkbenchRoles || noRoles;
  const preferred = user?.preferredWorkbench;
  const fallbackRole: WorkbenchRole = user?.role === "manager" ? "manager" : "service";
  const defaultRole: WorkbenchRole = preferred && availableRoles.includes(preferred)
    ? preferred : availableRoles.includes(fallbackRole) ? fallbackRole : availableRoles[0] || "service";
  const selected = choice?.owner === user?.id && choice?.query === query ? choice.role : null;
  const requested = isWorkbenchRole(query) && availableRoles.includes(query) ? query : null;
  const dashboardRole = selected && availableRoles.includes(selected) ? selected : requested || defaultRole;

  useEffect(() => () => { sequence.current += 1; }, [user?.id, user?.role]);

  const selectDashboardRole = (role: WorkbenchRole) => {
    if (!user || !availableRoles.includes(role)) return;
    const generation = ++sequence.current;
    setChoice({ owner: user.id, query, role });
    setSaveState({ owner: user.id, pending: true, error: "" });
    void updateWorkbenchPreference(role).then(() => {
      if (generation === sequence.current) setSaveState({ owner: user.id, pending: false, error: "" });
    }).catch((cause: unknown) => {
      if (generation === sequence.current) setSaveState({ owner: user.id, pending: false,
        error: cause instanceof Error ? cause.message : "工作台偏好保存失敗。" });
    });
  };

  return {
    availableRoles, dashboardRole, selectDashboardRole,
    preferenceSaving: saveState?.owner === user?.id && saveState?.pending === true,
    preferenceError: saveState?.owner === user?.id ? saveState?.error || "" : "",
    preferenceSaved: Boolean(saveState && saveState.owner === user?.id && !saveState.pending && !saveState.error),
  };
}
