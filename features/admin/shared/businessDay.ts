import { adminApi } from "@/features/admin/api/client.js";

/** API-selected operating day; never replace an unavailable day with browser today. */
export function requireBusinessDate(context: unknown): string {
  if (typeof context !== "object" || context === null || !("referenceBusinessDate" in context)) {
    throw new Error("無法確認目前營業日，請重新整理後再操作。");
  }
  const date = context.referenceBusinessDate;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("目前營業日資料不完整，請重新整理後再操作。");
  }
  return date;
}

export async function getAdminBusinessDate(signal?: AbortSignal): Promise<string> {
  return requireBusinessDate(await adminApi.getOrderingContext(signal));
}
