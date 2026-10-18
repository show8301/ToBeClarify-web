"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { staffingServiceAlerts } from "./staffing";
import { formatDateTime, orderStatusLabel, roomStatusLabel } from "./operationsFormat";
import { managerOrderRoute } from "./managerOverview";
import type { ManagerSettings } from "./managerOverview";
import type { OperationsData, OperationsOrder } from "./operationsTypes";
import { errorText } from "./workbenchApi";

const terminal = new Set(["completed", "cancelled", "rejected", "expired"]);
const waiting = new Set(["waiting", "submitted", "partially_confirmed"]);
type Filter = "attention" | "coordination" | "unfinished";

export function ManagerTasksPanel({ data, settings, disabled, navigate, onChanged }: {
  data: OperationsData; settings: ManagerSettings | null; disabled: boolean; navigate: (route: string) => void; onChanged: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("attention");
  const [decision, setDecision] = useState<{ order: OperationsOrder; value: "approved" | "rejected" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const date = data.context?.referenceBusinessDate || "";
  const alerts = staffingServiceAlerts(data.orders, data.staff, data.refreshedAt);
  const minutes = (order: OperationsOrder) => Math.max(order.queueMinutes, waiting.has(order.status) || order.storeConfirmationStatus === "pending"
    ? Math.max(0, Math.floor((data.refreshedAt - Date.parse(order.submittedAt)) / 60000)) || 0 : 0);
  const coordination = (order: OperationsOrder) => order.storeConfirmationStatus === "pending" || order.status === "needs_reschedule"
    || order.nominees.some((n) => n.confirmationStatus === "needs_coordination");
  const attention = (order: OperationsOrder) => coordination(order) || waiting.has(order.status) || Boolean(settings && minutes(order) >= settings.reminderMinutes);
  const orders = data.orders.filter((order) => !terminal.has(order.status));
  const visible = orders.filter((order) => filter === "unfinished" || (filter === "coordination" ? coordination(order) : attention(order)))
    .sort((a, b) => Number(coordination(b)) - Number(coordination(a)) || minutes(b) - minutes(a) || a.submittedAt.localeCompare(b.submittedAt));

  const decide = async () => {
    if (!decision || lock.current || disabled || !reason.trim()) return;
    lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    let saved = false;
    try {
      await adminApi.decideStoreConfirmation(decision.order.id, decision.value, reason.trim(), controller.signal);
      saved = true; setDecision(null);
      await onChanged();
    } catch (e) { if (!controller.signal.aborted) setError(`${saved ? "已完成協調決定；重新讀取失敗：" : ""}${errorText(e)}`); }
    finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  };

  return <>
    <AdminPanel title={<span className="adminFieldHeading">現場待辦與異常<AdminHelp title="現場待辦與異常說明">{`先處理店家協調與積壓，再進入顧客明細處理改期、保留、跨期及取消。${settings ? `等待 ${settings.reminderMinutes} 分鐘提醒，${settings.escalateMinutes} 分鐘升級關注；沿用店內設定。` : ""}`}</AdminHelp></span>}>
      <div className="managerFilters" role="group" aria-label="經理待辦範圍">
        {([ ["attention", "需處理", orders.filter(attention).length], ["coordination", "待協調", orders.filter(coordination).length], ["unfinished", "全部未完成", orders.length] ] as const).map(([value, label, count]) => <AdminButton key={value} variant={filter === value ? "primary" : "secondary"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} {count}</AdminButton>)}
      </div>
      {!settings && <p className="managerHint" role="status">提醒門檻尚未取得，仍列出待確認與協調單。</p>}
      {alerts.map((alert) => <article className="managerAlert" key={alert.id}><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><AdminButton variant="secondary" onClick={() => navigate("/admin/duty-planning")}>確認值班規劃</AdminButton></article>)}
      {error && <p className="adminFormError" role="alert">{error}</p>}
      <div className="managerQueue" aria-busy={disabled}>
        {visible.map((order) => {
          const age = minutes(order);
          const overdue = settings && age >= settings.escalateMinutes;
          return <article className={`managerTask${overdue ? " isUrgent" : ""}`} key={order.id}>
            <div className="managerTaskIdentity"><strong>{order.customerName}</strong><small>{order.orderNumber} · ID {order.gameId}</small></div>
            <div className="managerTaskCopy"><strong>{order.storeConfirmationStatus === "pending" ? "等待店家決定承接" : orderStatusLabel(order.status)}</strong><small>{waiting.has(order.status) || order.storeConfirmationStatus === "pending" ? `等待 ${age} 分鐘${overdue ? " · 已達升級門檻" : ""}` : `下單 ${formatDateTime(order.submittedAt)}`}</small><small>{order.nominees.map((n) => n.staffName).join("、") || order.items?.map((item) => `${item.name} ×${item.quantity}`).join("、")}</small></div>
            <div className="managerTaskActions">
              {order.storeConfirmationStatus === "pending" && <><AdminButton disabled={disabled || busy} onClick={() => { setDecision({ order, value: "approved" }); setReason(""); setError(""); }}>接受協調單</AdminButton><AdminButton variant="danger" disabled={disabled || busy} onClick={() => { setDecision({ order, value: "rejected" }); setReason(""); setError(""); }}>拒絕</AdminButton></>}
              <AdminButton variant="secondary" disabled={disabled || busy} onClick={() => navigate(managerOrderRoute(date, order.sessionId))}>顧客明細／履約</AdminButton>
            </div>
          </article>;
        })}
        {!visible.length && <p className="adminRoleDashboardEmpty">{disabled ? "正在確認今日待辦…" : "此範圍目前沒有待辦。"}</p>}
      </div>
    </AdminPanel>
    <AdminDialog open={Boolean(decision)} title={decision?.value === "approved" ? "接受店家協調單" : "拒絕店家協調單"} description={decision ? `${decision.order.customerName} · ${decision.order.orderNumber}；接受後仍依各服務的承接流程處理。` : ""} onClose={() => { if (!lock.current) setDecision(null); }} actions={null}>
      <form className="managerForm" onSubmit={(event) => { event.preventDefault(); void decide(); }}><AdminField label="處理原因" required><textarea required rows={3} maxLength={500} disabled={busy} value={reason} onChange={(e) => setReason(e.target.value)} /></AdminField>{error && <p className="adminFormError" role="alert">{error}</p>}<AdminButton type="submit" variant={decision?.value === "rejected" ? "danger" : "primary"} disabled={disabled || busy || !reason.trim()}>{busy ? "處理中…" : "確認送出"}</AdminButton></form>
    </AdminDialog>
  </>;
}

export function ManagerRoomsPanel({ data, disabled, navigate, onCreate }: { data: OperationsData; disabled: boolean; navigate: (route: string) => void; onCreate: () => void }) {
  const orders = data.roomOrders.filter((order) => !terminal.has(order.status) && order.status !== "completed").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return <AdminPanel className="managerRoomsPanel" title="包廂服務" description={`預約 ${orders.filter((o) => o.status === "scheduled").length} 筆 · 服務中 ${orders.filter((o) => o.status === "in_service").length} 筆`} actions={<><AdminButton disabled={disabled} onClick={onCreate}>訂購包廂</AdminButton><AdminButton variant="ghost" onClick={() => navigate(`/admin/rooms/service?${new URLSearchParams({ date: data.context?.referenceBusinessDate || "" })}`)}>完整包廂管理</AdminButton></>}>
    <div className="managerQueue managerQueueCompact">{orders.map((order) => <article className="managerTask" key={order.id}><div className="managerTaskIdentity"><strong>{order.roomName}</strong><small>{roomStatusLabel(order.status)}</small></div><div className="managerTaskCopy"><strong>{formatDateTime(order.startsAt)} ～ {formatDateTime(order.endsAt)}</strong><small>{order.note || "無備註"}</small>{Date.parse(order.endsAt) <= data.refreshedAt && <small className="managerWarning">已過預定結束時間，請核對服務是否完成。</small>}</div></article>)}{!orders.length && <p className="adminRoleDashboardEmpty">{disabled ? "正在確認包廂狀態…" : "目前沒有未完成的包廂服務。"}</p>}</div>
  </AdminPanel>;
}
