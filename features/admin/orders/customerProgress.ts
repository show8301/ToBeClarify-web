export type CustomerListItem = {
  session: { id: string; customerName: string; gameId: string };
  orderCount: number;
  waitingOrderCount: number;
  totalAmount: number;
};

export const customerGroups = [
  { key: "attention", title: "待確認／需協調" },
  { key: "active", title: "待履約／服務中" },
  { key: "unknown", title: "狀態待確認" },
  { key: "completed", title: "訂單已完成" },
  { key: "inactive", title: "僅取消／失效" },
  { key: "empty", title: "尚未下單" },
] as const;

export type CustomerGroupKey = typeof customerGroups[number]["key"];
export type CustomerProgress = { group: CustomerGroupKey; label: string };

// ConfirmedOrderCount also includes completed orders, so it cannot identify unfinished work.
export function customerProgress(value: unknown, expectedCount: number): CustomerProgress {
  if (!Array.isArray(value) || value.length !== expectedCount) throw new Error("訂單數量已變更，請重新整理。");
  let attention = 0;
  let active = 0;
  let completed = 0;
  let unknown = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !("status" in entry) || typeof entry.status !== "string") {
      throw new Error("訂單狀態格式異常。");
    }
    if (["waiting", "submitted", "partially_confirmed", "needs_reschedule"].includes(entry.status)
      || "storeConfirmationStatus" in entry && entry.storeConfirmationStatus === "pending") attention++;
    else if (["confirmed", "in_service"].includes(entry.status)) active++;
    else if (entry.status === "completed") completed++;
    else if (!["cancelled", "expired", "rejected"].includes(entry.status)) unknown++;
  }
  if (attention) return { group: "attention", label: `${attention} 張待確認／協調` };
  if (active) return { group: "active", label: `${active} 張尚未完成` };
  if (unknown) return { group: "unknown", label: "訂單狀態待確認" };
  if (completed) return { group: "completed", label: `${completed} 張已完成` };
  if (value.length) return { group: "inactive", label: "僅取消／失效訂單" };
  return { group: "empty", label: "尚未下單" };
}
