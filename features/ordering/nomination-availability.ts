export type NominationWindow = { startsAt: string; endsAt: string };
export type StaffAvailability = {
  staffId: string;
  isAccepting: boolean;
  shiftStartsAt: string | null;
  shiftEndsAt: string | null;
  bufferMinutes: number;
  isServing: boolean;
  isOverdue: boolean;
  windows: NominationWindow[];
};
export type NominationAvailability = {
  businessDate: string;
  checkedAt: string;
  projectedCloseAt: string | null;
  nominationPaused: boolean;
  staff: StaffAvailability[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

function nullableTimestamp(value: unknown): value is string | null {
  return value === null || timestamp(value);
}

export function parseNominationAvailability(value: unknown): NominationAvailability {
  if (!record(value) || typeof value.businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.businessDate)
    || !timestamp(value.checkedAt) || !nullableTimestamp(value.projectedCloseAt)
    || typeof value.nominationPaused !== "boolean" || !Array.isArray(value.staff)) {
    throw new Error("可預約時段資料不完整，請稍後再試。");
  }
  const staff = value.staff.map((person: unknown): StaffAvailability => {
    if (!record(person) || typeof person.staffId !== "string" || typeof person.isAccepting !== "boolean"
      || !nullableTimestamp(person.shiftStartsAt) || !nullableTimestamp(person.shiftEndsAt)
      || typeof person.bufferMinutes !== "number" || !Number.isInteger(person.bufferMinutes) || person.bufferMinutes < 0
      || typeof person.isServing !== "boolean" || typeof person.isOverdue !== "boolean" || !Array.isArray(person.windows)) {
      throw new Error("店員可預約時段資料不完整，請稍後再試。");
    }
    const windows = person.windows.map((window: unknown): NominationWindow => {
      if (!record(window) || !timestamp(window.startsAt) || !timestamp(window.endsAt)
        || Date.parse(window.endsAt) <= Date.parse(window.startsAt)) {
        throw new Error("可預約時段資料不完整，請稍後再試。");
      }
      return { startsAt: window.startsAt, endsAt: window.endsAt };
    });
    return { staffId: person.staffId, isAccepting: person.isAccepting, shiftStartsAt: person.shiftStartsAt,
      shiftEndsAt: person.shiftEndsAt, bufferMinutes: person.bufferMinutes, isServing: person.isServing,
      isOverdue: person.isOverdue, windows };
  });
  return { businessDate: value.businessDate, checkedAt: value.checkedAt, projectedCloseAt: value.projectedCloseAt,
    nominationPaused: value.nominationPaused, staff };
}

export function availableStarts(person: StaffAvailability | undefined, durationMinutes: number, now: number): string[] {
  if (!person?.isAccepting || person.isOverdue || durationMinutes <= 0) return [];
  const duration = (durationMinutes + person.bufferMinutes) * 60_000;
  const starts: string[] = [];
  for (const window of person.windows) {
    // One-minute precision matches the existing datetime-local contract. Always
    // leave a minute to submit; the API still revalidates the actual request.
    const first = Math.ceil(Math.max(Date.parse(window.startsAt), now + 60_000) / 60_000) * 60_000;
    const last = Date.parse(window.endsAt) - duration;
    for (let start = first; start <= last && starts.length < 2880; start += 60_000) {
      starts.push(new Date(start).toISOString());
    }
  }
  return [...new Set(starts)].sort();
}

export function nominationStatus(person: StaffAvailability | undefined, minimumMinutes: number,
  now: number, projectedCloseAt: string | null): string {
  if (!person) return "暫時無法確認可預約時段";
  if (!person.isAccepting) return "暫停接受新指名";
  if (!person.shiftStartsAt || !person.shiftEndsAt) return "本日未排班";
  if (Date.parse(person.shiftEndsAt) <= now) return "本日班次已結束";
  if (person.isOverdue) return "服務尚未結束，暫停預約";
  const starts = availableStarts(person, minimumMinutes, now);
  const close = projectedCloseAt ? Date.parse(projectedCloseAt) : Infinity;
  if (!starts.some(start => Date.parse(start) + (minimumMinutes + person.bufferMinutes) * 60_000 <= close)) {
    return "今日預約已滿";
  }
  if (Date.parse(person.shiftStartsAt) > now) return "尚未到班，可預約稍後時段";
  if (person.isServing || !person.windows.some(w => Date.parse(w.startsAt) <= now && Date.parse(w.endsAt) > now)) {
    return "服務中，可預約稍後時段";
  }
  const availableEnd = person.windows.find(w => Date.parse(w.startsAt) <= now && Date.parse(w.endsAt) > now)?.endsAt;
  return availableEnd && Date.parse(availableEnd) < Math.min(Date.parse(person.shiftEndsAt), close)
    ? "可指名，部分時段已預約" : "可指名";
}
