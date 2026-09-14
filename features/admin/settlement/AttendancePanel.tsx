"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";

type Summary = {
  staffId: string; displayName: string; dutyPlanId?: string | null; scheduledStart?: string | null; scheduledEnd?: string | null;
  actualStart?: string | null; actualEnd?: string | null; scheduledMinutes: number; workedMinutes: number;
  adjustmentMinutes: number; effectiveMinutes: number; hasOpenShift: boolean; stopAcceptingNewOrders: boolean;
  activeServiceCount: number; affectedOrders?: Array<{ orderId: string; orderNumber: string; orderStatus: string; customerName?: string | null; requestedStart: string; requestedEnd: string }>;
};

async function fetchAttendanceRows(businessDate: string): Promise<Summary[]> {
  const next = await adminApi.getAttendance(businessDate);
  return next?.staff || [];
}

export function AttendancePanel({ businessDate, canManage }: { businessDate: string; canManage: boolean }) {
  const [rows, setRows] = useState<Summary[]>([]);
  const [selected, setSelected] = useState("");
  const [action, setAction] = useState<"clock_in" | "clock_out" | "add_minutes" | "subtract_minutes" | "set_times" | "stop_orders" | "resume_orders">("clock_in");
  const [minutes, setMinutes] = useState(30);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!businessDate) return;
    try {
      const values = await fetchAttendanceRows(businessDate);
      setRows(values);
      setSelected(current => current || values[0]?.staffId || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法讀取出勤狀態");
    }
  };
  useEffect(() => {
    if (!businessDate) return;
    let active = true;
    fetchAttendanceRows(businessDate)
      .then(values => {
        if (!active) return;
        setRows(values);
        setSelected(current => current || values[0]?.staffId || "");
      })
      .catch(error => {
        if (active) setMessage(error instanceof Error ? error.message : "無法讀取出勤狀態");
      });
    return () => { active = false; };
  }, [businessDate]);
  const current = rows.find(row => row.staffId === selected);
  const apply = async () => {
    if (!selected) return; setBusy(true); setMessage("");
    try {
      await adminApi.applyAttendance({ operationId: crypto.randomUUID(), businessDate, staffId: selected, action,
        occurredAt: start ? `${start}:00+08:00` : undefined, endedAt: end ? `${end}:00+08:00` : undefined,
        minutes: action === "add_minutes" || action === "subtract_minutes" ? minutes : undefined, reason: reason.trim() || undefined });
      setMessage(action === "stop_orders" ? "已停止接受新的指名單，既有服務仍保留。" : action === "resume_orders" ? "已恢復接受新的指名單。" : "出勤紀錄已更新，原紀錄仍保留。"); setReason(""); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "出勤操作失敗"); }
    finally { setBusy(false); }
  };
  return <AdminPanel title="出勤與接單狀態" description="自動班表事件可重跑；人工上下班、增加／減少分鐘與修改時間會留下獨立來源，跨午夜班次仍視為同一班。">
    {rows.length === 0 ? <p>今天沒有已核准的工作班次。</p> : <>
      {canManage ? <AdminField label="店員"><select value={selected} onChange={e => setSelected(e.target.value)}>{rows.map(row => <option key={row.staffId} value={row.staffId}>{row.displayName}</option>)}</select></AdminField> : null}
      {current ? <div className="adminSettlementSummary"><div><span>班表分鐘</span><strong>{current.scheduledMinutes}</strong></div><div><span>有效工時</span><strong>{current.effectiveMinutes}</strong></div><div><span>增減補正</span><strong>{current.adjustmentMinutes >= 0 ? "+" : ""}{current.adjustmentMinutes}</strong></div><div><span>狀態</span><strong>{current.stopAcceptingNewOrders ? "停止新單" : current.hasOpenShift ? "進行中" : "可接單"}</strong></div></div> : null}
      {current?.affectedOrders?.length ? <div className="adminAttendanceAffected"><strong>停止新單後的協調清單</strong>{current.affectedOrders.map(order => <div key={order.orderId}><span>{order.orderNumber}{order.customerName ? `｜${order.customerName}` : ""}</span><small>{new Date(order.requestedStart).toLocaleString("zh-TW")} ～ {new Date(order.requestedEnd).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} · {order.orderStatus}</small></div>)}</div> : null}
      <div className="adminFormGrid"><AdminField label="操作"><select value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="clock_in">人工上班</option><option value="clock_out">人工下班</option><option value="add_minutes">增加分鐘</option><option value="subtract_minutes">減少分鐘</option><option value="set_times">修改實際上下班</option><option value="stop_orders">提前離店／停止新單</option><option value="resume_orders">恢復接單</option></select></AdminField><AdminField label="上班時間（修改時）"><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></AdminField><AdminField label="下班時間（修改時）"><input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></AdminField>{(action === "add_minutes" || action === "subtract_minutes") ? <AdminField label="分鐘"><input type="number" min="1" value={minutes} onChange={e => setMinutes(Number(e.target.value) || 1)} /></AdminField> : null}<AdminField label="原因"><input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="可選；例如服務延後下班" /></AdminField></div>
      <AdminButton onClick={() => void apply()} disabled={busy || !selected}>保存出勤操作</AdminButton>
      {message ? <p role="status">{message}</p> : null}
      <div className="adminSettlementTableWrap"><table className="adminSettlementTable"><thead><tr><th>人員</th><th>預計</th><th>實際</th><th>有效分鐘</th><th>服務中</th><th>接單</th></tr></thead><tbody>{rows.map(row => <tr key={row.staffId}><td>{row.displayName}</td><td>{row.scheduledStart ? new Date(row.scheduledStart).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "—"}–{row.scheduledEnd ? new Date(row.scheduledEnd).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td>{row.actualStart ? new Date(row.actualStart).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "—"}–{row.actualEnd ? new Date(row.actualEnd).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td><strong>{row.effectiveMinutes}</strong></td><td>{row.activeServiceCount > 0 ? `${row.activeServiceCount} 筆` : "—"}</td><td>{row.stopAcceptingNewOrders ? "停止新單" : "可接單"}</td></tr>)}</tbody></table></div>
    </>}
  </AdminPanel>;
}
