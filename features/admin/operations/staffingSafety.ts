import type { OperationsDutyPlan } from "./operationsTypes";

export type DutyPlanEditMode = "add" | "edit";
export type ShiftRange = { startsAt: number; endsAt: number };
export type StaffCommitment = { id: string; name: string; startsAt: number; endsAt: number };

export function initialDutyWorking(mode: DutyPlanEditMode, existing: OperationsDutyPlan | null) {
  return mode === "add" ? true : existing?.isWorking ?? true;
}

export function shiftRange(businessDate: string, startTime: string, endTime: string): ShiftRange | null {
  const valid = /^(?:[01]\d|2[0-7]):[0-5]\d$/;
  if (!valid.test(startTime) || !valid.test(endTime)) return null;
  const midnight = Date.parse(`${businessDate}T00:00:00+08:00`);
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const start = minutes(startTime);
  const rawEnd = minutes(endTime);
  const end = rawEnd + (rawEnd <= start ? 1440 : 0);
  if (!Number.isFinite(midnight) || startTime === endTime || end <= start || end - start > 1440) return null;
  return { startsAt: midnight + start * 60000, endsAt: midnight + end * 60000 };
}

export function reducesAvailability(existing: OperationsDutyPlan | null, isWorking: boolean, range: ShiftRange | null) {
  if (!existing?.isWorking || existing.approvalStatus !== "approved") return false;
  if (!isWorking || !range) return true;
  const startsAt = Date.parse(existing.startsAt || ""), endsAt = Date.parse(existing.endsAt || "");
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) return true;
  return range.startsAt > startsAt || range.endsAt < endsAt;
}

export function affectedCommitments(commitments: StaffCommitment[], isWorking: boolean, range: ShiftRange | null) {
  return commitments.filter((item) => !isWorking || !range || item.startsAt < range.startsAt || item.endsAt > range.endsAt);
}

export function parseStaffCommitments(value: unknown, staffId: string): StaffCommitment[] {
  if (!value || typeof value !== "object" || !("reservations" in value) || !Array.isArray(value.reservations)
    || !("syncedAt" in value) || typeof value.syncedAt !== "string" || !Number.isFinite(Date.parse(value.syncedAt))) {
    throw new Error("服務與預約資料格式異常。");
  }
  const result: StaffCommitment[] = [];
  for (const item of value.reservations) {
    if (!item || typeof item !== "object" || !("staffId" in item) || typeof item.staffId !== "string") throw new Error("預約店員資料不完整。");
    if (item.staffId !== staffId) continue;
    if (!("id" in item) || typeof item.id !== "string" || !item.id || !("status" in item) || typeof item.status !== "string") throw new Error("預約狀態資料不完整。");
    if (["completed", "cancelled", "expired", "rejected", "declined"].includes(item.status)) continue;
    if (!("startsAt" in item) || typeof item.startsAt !== "string" || !("endsAt" in item) || typeof item.endsAt !== "string") throw new Error("預約時段資料不完整。");
    const startsAt = Date.parse(item.startsAt), endsAt = Date.parse(item.endsAt);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) throw new Error("預約時段格式異常。");
    const name = "serviceLabel" in item && typeof item.serviceLabel === "string" ? item.serviceLabel : "既有服務／預約";
    result.push({ id: item.id, name, startsAt, endsAt });
  }
  return result;
}
