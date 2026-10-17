import type { AdminIdentity, WorkbenchRole } from "./types";

export function isWorkbenchRole(value: unknown): value is WorkbenchRole {
  return value === "service" || value === "designated" || value === "manager";
}

export function parseAdminIdentity(value: unknown): AdminIdentity {
  if (!value || typeof value !== "object") throw new Error("登入身份資料不完整，請重新登入。");
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  if (typeof record.id !== "string" || !record.id
    || typeof record.loginName !== "string" || typeof record.displayName !== "string"
    || typeof record.roleLabel !== "string"
    || (record.role !== "clerk" && record.role !== "manager" && record.role !== "developer")
    || (record.staffMemberId !== null && typeof record.staffMemberId !== "string")) {
    throw new Error("登入身份資料不完整，請重新登入。");
  }
  const permitted: WorkbenchRole[] = record.role === "clerk"
    ? ["service", "designated"] : ["service", "designated", "manager"];
  // Older API identities can be read during the additive rollout. Saving still
  // requires the preferences endpoint and never falls back to browser storage.
  const available = record.availableWorkbenchRoles === undefined ? permitted : record.availableWorkbenchRoles;
  if (!Array.isArray(available) || !available.length || !available.every(isWorkbenchRole)
    || available.some((role) => !permitted.includes(role))
    || (record.preferredWorkbench != null && !isWorkbenchRole(record.preferredWorkbench))) {
    throw new Error("工作台設定格式異常，請重新登入。");
  }
  return {
    id: record.id,
    loginName: record.loginName,
    displayName: record.displayName,
    role: record.role,
    roleLabel: record.roleLabel,
    staffMemberId: record.staffMemberId,
    preferredWorkbench: isWorkbenchRole(record.preferredWorkbench) && available.includes(record.preferredWorkbench)
      ? record.preferredWorkbench : null,
    availableWorkbenchRoles: [...new Set(available)],
  };
}
