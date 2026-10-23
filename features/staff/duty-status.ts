import type { StaffDutyStatus } from "./types";

export function parseStaffDutyStatuses(value: unknown): StaffDutyStatus[] {
  if (!Array.isArray(value)) throw new Error("Invalid staff duty status response");
  return value.map((item: unknown) => {
    if (typeof item !== "object" || item === null || !("id" in item)
      || typeof item.id !== "string" || !item.id
      || !("isWorkingToday" in item) || typeof item.isWorkingToday !== "boolean"
      || !("currentStatus" in item)
      || (item.currentStatus !== "off" && item.currentStatus !== "busy" && item.currentStatus !== "available")
      || !("statusText" in item) || typeof item.statusText !== "string"
      || !("isNominatable" in item) || typeof item.isNominatable !== "boolean") {
      throw new Error("Invalid staff duty status response");
    }
    return {
      id: item.id,
      isWorkingToday: item.isWorkingToday,
      currentStatus: item.currentStatus,
      statusText: item.statusText,
      isNominatable: item.isNominatable,
    };
  });
}
