import type { ArtDelivery } from "@/features/admin/customers/types";

export function taipeiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function isOverdue(delivery: ArtDelivery, today = taipeiToday()): boolean {
  return ["pending", "in_progress"].includes(delivery.status) && Boolean(delivery.dueDate && delivery.dueDate.slice(0, 10) < today);
}
export function nextAction(delivery: ArtDelivery): string {
  if (delivery.status === "cancelled") return "已取消，保留處理紀錄";
  if (delivery.status === "delivered") return "已領取，查看處理紀錄";
  if (delivery.status === "ready") return delivery.notifiedAt ? "已通知，等待顧客確認收到" : "傳送領取資料並記錄通知";
  return delivery.assets.length ? "核對附件後開放領取" : "加入作品圖片或雲端連結";
}
export const HISTORY_LABELS: Record<string, string> = {
  created: "建立委託", updated_pending: "儲存為待製作", updated_in_progress: "儲存為製作中",
  updated_ready: "儲存為可領取", updated_delivered: "後台標記已領取", updated_cancelled: "取消委託",
  asset_added: "加入附件", asset_removed: "移除附件", claim_code_reissued: "重發領取碼，舊碼失效",
  claim_code_viewed: "檢視領取碼", assignment_changed: "變更負責人", customer_notified: "人員記錄已通知顧客",
  customer_acknowledged: "顧客確認收到",
};
