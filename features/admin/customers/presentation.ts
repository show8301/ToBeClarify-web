export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: "待製作",
  in_progress: "製作中",
  ready: "可領取",
  delivered: "已領取",
  cancelled: "已取消",
};

export function formatMoney(value: number) {
  return `${value.toLocaleString("zh-TW")} G`;
}

export function formatCustomerTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

export function queryPath(path: string, values: Record<string, string | number | null | undefined>) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") parameters.set(key, String(value));
  }
  return parameters.size ? `${path}?${parameters}` : path;
}

export function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "操作失敗，請稍後再試。";
}
