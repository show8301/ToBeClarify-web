"use client";
import { useCallback } from "react";
import { useCustomerResource } from "@/features/admin/customers/useCustomerResource";
import { formatCustomerTime } from "@/features/admin/customers/presentation";
import { workspaceApi } from "./workspaceApi";
import { HISTORY_LABELS } from "./presentation";
export function DeliveryHistoryPanel({ id, revision, available }: { id: string; revision: number; available: boolean }) {
  const load = useCallback((signal: AbortSignal) => available ? workspaceApi.history(id, signal) : Promise.resolve(null), [id, available]);
  const { data, loading, error } = useCustomerResource(`${id}:${revision}`, load);
  if (!available) return <p className="adminCustomerHint">處理紀錄服務尚未啟用。</p>;
  return <div className="adminDeliveryTabContent"><p className="adminCustomerHint">顧客確認與後台人工標記分開記錄。顯示最近 200 筆。</p>{loading ? <p role="status">正在讀取紀錄…</p> : null}{error ? <p className="adminCustomerFeedback isError" role="alert">{error}</p> : null}
    <ol className="adminDeliveryHistory">{data?.map((item) => <li key={item.id}><strong>{HISTORY_LABELS[item.action] || "其他交付操作"}</strong><span>{item.actorName || "未記錄操作人員"} · {formatCustomerTime(item.createdAt)}</span></li>)}</ol>{data?.length === 0 ? <p>尚無處理紀錄。</p> : null}</div>;
}
