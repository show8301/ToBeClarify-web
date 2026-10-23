import type { StaffDutyStatus } from "./types";

export const NOMINATION_LABELS: Record<string, string> = {
  available: "可指名",
  before_shift: "尚未到班，可預約稍後時段",
  busy: "服務中，可預約稍後時段",
  partially_reserved: "可指名，部分時段已預約",
  fully_booked: "今日預約已滿",
  paused: "暫停接受新指名",
  off: "本日未排班",
  ended: "本日班次已結束",
  overdue: "服務尚未結束，暫停預約",
};

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
      nominationStatus: "nominationStatus" in item && typeof item.nominationStatus === "string" && Object.hasOwn(NOMINATION_LABELS, item.nominationStatus)
        ? item.nominationStatus : undefined,
    };
  });
}
