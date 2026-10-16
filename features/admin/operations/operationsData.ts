import { requireBusinessDate } from "@/features/admin/shared/businessDay";
import { parseStaffDailyWorkMode } from "./staffWorkStatus";
import { booleanValue, isRecord, numberValue, stringValue } from "./operationsFormat";
import type { OperationsContext, OperationsStaffMember } from "./operationsTypes";

export function normalizeContext(value: unknown): OperationsContext | null {
  if (!isRecord(value)) return null;
  return {
    referenceBusinessDate: requireBusinessDate(value),
    version: typeof value.version === "number" && Number.isSafeInteger(value.version) ? value.version : undefined,
    flowVersion: value.flowVersion === 1 || value.flowVersion === 2 ? value.flowVersion : undefined,
    businessPeriodId: stringValue(value.businessPeriodId),
    referenceStartsAt: stringValue(value.referenceStartsAt),
    referenceEndsAt: stringValue(value.referenceEndsAt),
    periodStatus: stringValue(value.periodStatus, "scheduled"),
    intakeMode: stringValue(value.intakeMode, "staff_only"),
    orderingOpen: booleanValue(value.orderingOpen),
    projectedCloseAt: stringValue(value.projectedCloseAt),
    actualOpenedAt: stringValue(value.actualOpenedAt),
    waitingOrderCount: numberValue(value.waitingOrderCount),
    unfinishedOrderCount: numberValue(value.unfinishedOrderCount),
    openSessionCount: numberValue(value.openSessionCount),
    latestCommittedBusyUntil: stringValue(value.latestCommittedBusyUntil),
  };
}

export function normalizeStaffMember(value: unknown): OperationsStaffMember | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  const workMode = parseStaffDailyWorkMode(value);
  return { id, displayName: stringValue(value.displayName, "未命名店員"), roleTitle: stringValue(value.roleTitle), statusText: stringValue(value.statusText), isWorkingToday: booleanValue(value.isWorkingToday, false), isActive: booleanValue(value.isActive, true), todayShift: stringValue(value.todayShift), todayWorkMode: workMode };
}
