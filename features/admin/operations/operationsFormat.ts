export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value === null || value === undefined ? fallback : String(value);
}

export function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function booleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

export function formatClock(value: unknown, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateTime(value: unknown, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatMoney(value: unknown) {
  return `${numberValue(value).toLocaleString("zh-TW")} G`;
}

export function orderStatusLabel(status: string) {
  return {
    waiting: "等待確認",
    submitted: "等待確認",
    partially_confirmed: "部分確認",
    needs_reschedule: "需重新排程",
    confirmed: "已成立",
    in_service: "服務中",
    completed: "已完成",
    cancelled: "已取消",
    expired: "已失效",
    rejected: "已退回",
  }[status] || status || "未知狀態";
}

export function roomStatusLabel(status: string) {
  return {
    scheduled: "已預約",
    in_service: "服務中",
    completed: "已完成",
    cancelled: "已取消",
  }[status] || status || "未知狀態";
}

export function intakeModeLabel(mode: string) {
  return {
    normal: "一般接單",
    coordination: "協調接單",
    staff_only: "僅店員接單",
  }[mode] || "尚未接單";
}

export function periodStatusLabel(status: string) {
  return {
    scheduled: "尚未開店",
    open: "營業中",
    closed: "已關店",
    settled: "已結算",
  }[status] || "尚未開店";
}
