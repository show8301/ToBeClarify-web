import { isRecord } from "./operationsFormat";
import type { StaffDailyWorkMode, WorkRole } from "./operationsTypes";
import { isPayrollRole } from "@/features/admin/shared/workRoles";

export const workRoleOptions: ReadonlyArray<{ id: WorkRole; label: string }> = [
  { id: "service", label: "服務員" },
  { id: "designated", label: "指名人員" },
  { id: "backstage", label: "幕後" },
];

function isWorkRole(value: unknown): value is WorkRole {
  return value === "service" || value === "designated" || value === "backstage";
}

export function parseStaffDailyWorkMode(value: unknown): StaffDailyWorkMode | null {
  if (!isRecord(value) || typeof value.isWorkingToday !== "boolean") return null;
  const mode = value.todayWorkMode;
  if (!isRecord(mode)
    || typeof mode.businessDate !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/.test(mode.businessDate)
    || typeof mode.stopAcceptingNewOrders !== "boolean"
    || !Array.isArray(mode.scheduledRoles) || !mode.scheduledRoles.every(isWorkRole)
    || !Array.isArray(mode.activeRoles) || !mode.activeRoles.every(isWorkRole)
    || !Array.isArray(mode.allowedSupportRoles) || !mode.allowedSupportRoles.every(isWorkRole)
    || (mode.payrollRole !== null && !isPayrollRole(mode.payrollRole))) return null;
  const scheduledRoles = mode.scheduledRoles;
  const activeRoles = mode.activeRoles;
  return {
    businessDate: mode.businessDate,
    isWorking: value.isWorkingToday,
    stopAcceptingNewOrders: mode.stopAcceptingNewOrders,
    scheduledRoles: [...new Set(scheduledRoles)],
    activeRoles: [...new Set(activeRoles)],
    payrollRole: mode.payrollRole,
    allowedSupportRoles: [...new Set(mode.allowedSupportRoles)],
  };
}
