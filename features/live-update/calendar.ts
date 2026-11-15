export type CalendarShift = {
  staffId: string;
  displayName: string;
  avatarUrl: string | null;
  startsAt: string;
  endsAt: string;
};
export type CalendarDay = {
  businessDate: string;
  status: "unannounced" | "planned" | "open" | "operated";
  startsAt: string | null;
  endsAt: string | null;
  staff: CalendarShift[];
};
export type BusinessCalendar = { month: string; today: string; days: CalendarDay[] };

export const calendarStatusLabels: Record<CalendarDay["status"], string> = {
  unannounced: "尚未公告", planned: "預計營業", open: "營業中", operated: "曾營業",
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function dateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
function shift(value: unknown): value is CalendarShift {
  return record(value) && typeof value.staffId === "string" && Boolean(value.staffId)
    && typeof value.displayName === "string" && (value.avatarUrl === null || typeof value.avatarUrl === "string")
    && timestamp(value.startsAt) && timestamp(value.endsAt) && Date.parse(value.endsAt) > Date.parse(value.startsAt);
}
function day(value: unknown): value is CalendarDay {
  if (!record(value) || !dateString(value.businessDate)
    || !["unannounced", "planned", "open", "operated"].includes(String(value.status))
    || !Array.isArray(value.staff) || !value.staff.every(shift)) return false;
  return value.status === "unannounced" ? value.startsAt === null && value.endsAt === null
    : timestamp(value.startsAt) && timestamp(value.endsAt);
}
export function parseBusinessCalendar(value: unknown): BusinessCalendar {
  if (!record(value) || typeof value.month !== "string" || !/^\d{4}-\d{2}$/.test(value.month)
    || !dateString(value.today) || !Array.isArray(value.days) || !value.days.every(day)) {
    throw new Error("營業行事曆資料格式異常，請稍後重試。");
  }
  const first = new Date(`${value.month}-01T12:00:00Z`);
  if (!Number.isFinite(first.getTime()) || first.toISOString().slice(0, 7) !== value.month) throw new Error("行事曆月份無效。");
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  if (value.days.length !== count || value.days.some((item, index) => item.businessDate !== `${value.month}-${String(index + 1).padStart(2, "0")}`)) {
    throw new Error("營業行事曆日期不完整，請稍後重試。");
  }
  return { month: value.month, today: value.today, days: value.days };
}

export function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

export function calendarTimeRange(startsAt: string, endsAt: string) {
  const time = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" });
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dayDifference = Math.round((Date.parse(date.format(end)) - Date.parse(date.format(start))) / 86400000);
  const prefix = dayDifference === 1 ? "翌日 " : dayDifference > 1 ? `${dayDifference} 日後 ` : "";
  return `${time.format(start)}～${prefix}${time.format(end)}`;
}

export async function getBusinessCalendar(month: string, signal: AbortSignal): Promise<BusinessCalendar> {
  const params = new URLSearchParams(month ? { month } : {});
  const response = await fetch(`/api/business-calendar?${params}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("暫時無法取得營業行事曆，請稍後重試。");
  const calendar = parseBusinessCalendar(await response.json());
  if (month && calendar.month !== month) throw new Error("行事曆月份不符，請重新查詢。");
  return calendar;
}
