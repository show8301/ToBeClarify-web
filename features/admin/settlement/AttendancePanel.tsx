"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { payrollRoleLabel, payrollRoleOptions, isPayrollRole } from "@/features/admin/shared/workRoles";
import type { PayrollRole } from "@/features/admin/shared/workRoles";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";

type Summary = {
  payrollRole?: PayrollRole | null; payrollSnapshotVersion?: number | null; canUseBackstage?: boolean; canUseManagerPayrollRole?: boolean;
  staffId: string; displayName: string; dutyPlanId?: string | null; scheduledStart?: string | null; scheduledEnd?: string | null;
  actualStart?: string | null; actualEnd?: string | null; scheduledMinutes: number; workedMinutes: number;
  adjustmentMinutes: number; effectiveMinutes: number; hasOpenShift: boolean; stopAcceptingNewOrders: boolean;
  activeServiceCount: number; affectedOrders?: Array<{ orderId: string; orderNumber: string; orderStatus: string; customerName?: string | null; requestedStart: string; requestedEnd: string }>;
};
type Action = "clock_in" | "clock_out" | "add_minutes" | "subtract_minutes" | "set_times" | "confirm_payroll_role" | "stop_orders" | "resume_orders";
type Props = { businessDate: string; canManage: boolean; staffId?: string; locked?: boolean; disabled?: boolean; active?: boolean; onBusyChange?: (busy: boolean) => void; onChanged?: () => Promise<boolean> };
const time = (value?: string | null) => value ? new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }) : "—";

export function AttendancePanel({ businessDate, canManage, staffId, locked = false, disabled = false, active = true, onBusyChange, onChanged }: Props) {
  const personal = staffId !== undefined;
  const [rows, setRows] = useState<Summary[]>([]);
  const [selected, setSelected] = useState("");
  const [action, setAction] = useState<Action>("clock_in");
  const [payrollRole, setPayrollRole] = useState<PayrollRole | "">("");
  const payrollInputId = useId();
  const [minutes, setMinutes] = useState(30);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const sequence = useRef(0);
  const applying = useRef(false);
  const load = useCallback((signal?: AbortSignal) => {
    if (!businessDate) return Promise.resolve(false);
    const request = ++sequence.current;
    return adminApi.getAttendance(businessDate, signal).then(next => {
      if (signal?.aborted || request !== sequence.current) return false;
      const values: Summary[] = next?.staff || [];
      setRows(values);
      setMessage("");
      setSelected(current => values.some(row => row.staffId === current) ? current : values[0]?.staffId || "");
      return true;
    }).catch((error: unknown) => {
      if (!signal?.aborted && request === sequence.current) setMessage(error instanceof Error ? error.message : "無法讀取出勤狀態");
      return false;
    });
  }, [businessDate]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => { controller.abort(); sequence.current += 1; };
  }, [load, active]);
  const visibleRows = personal ? rows.filter(row => row.staffId === staffId) : rows;
  const selectedId = personal ? staffId : selected;
  const current = visibleRows.find(row => row.staffId === selectedId);
  const needsMinutes = action === "add_minutes" || action === "subtract_minutes";
  const needsStart = action === "clock_in" || action === "clock_out" || action === "set_times";
  const apply = async () => {
    if (!selectedId || locked || disabled || applying.current || (action === "confirm_payroll_role" && (!payrollRole || !reason.trim()))) return;
    applying.current = true;
    setBusy(true); onBusyChange?.(true); setMessage("");
    try {
      await adminApi.applyAttendance({ operationId: crypto.randomUUID(), businessDate, staffId: selectedId, action,
        occurredAt: needsStart && start ? `${start}:00+08:00` : undefined,
        endedAt: action === "set_times" && end ? `${end}:00+08:00` : undefined,
        minutes: needsMinutes ? minutes : undefined, payrollRole: action === "confirm_payroll_role" ? payrollRole : undefined, reason: reason.trim() || undefined });
      setReason("");
      const refreshed = await load();
      const settlementRefreshed = onChanged ? await onChanged().catch(() => false) : true;
      if (!settlementRefreshed) setMessage("出勤已保存，但結算預覽刷新失敗，請重新整理結算資料；不需重送出勤操作。");
      else if (refreshed) setMessage(action === "stop_orders" ? "已停止接受新的指名單，既有服務仍保留。" : action === "resume_orders" ? "已恢復接受新的指名單。" : onChanged ? "出勤與上班計薪職位資料已刷新；請核對輸入，保存後重新計算。幕後僅限開發人員。" : "出勤紀錄已更新；重新計算後更新薪資預覽。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "出勤操作失敗"); }
    finally { applying.current = false; setBusy(false); onBusyChange?.(false); }
  };
  return <AdminPanel title={personal ? "個人出勤紀錄" : "出勤與接單核對"} description={personal ? "核對當日班次；人工修正會保留獨立紀錄。" : "先核對全員班次與有效工時，需要調整時再展開出勤修正。"}>
    {visibleRows.length === 0 ? <p className="adminEmptyText">{personal ? "這位人員當日沒有已核准的班次。" : "當日沒有已核准的工作班次。"}</p> : <>
      {personal && current ? <div className="adminSettlementSummary"><div><span>班表分鐘</span><strong>{current.scheduledMinutes}</strong></div><div><span>有效分鐘</span><strong>{current.effectiveMinutes}</strong></div><div><span>增減補正</span><strong>{current.adjustmentMinutes >= 0 ? "+" : ""}{current.adjustmentMinutes}</strong></div><div><span>接單狀態</span><strong>{current.stopAcceptingNewOrders ? "停止新單" : current.hasOpenShift ? "出勤中" : "可接單"}</strong></div></div> : null}
      <div className="adminSettlementTableWrap"><table className="adminSettlementTable"><thead><tr><th>人員</th><th>上班計薪職位</th><th>預計班次</th><th>實際出勤</th><th>有效分鐘</th><th>服務中</th><th>接單</th>{canManage && !personal && !locked ? <th>修正</th> : null}</tr></thead><tbody>{visibleRows.map(row => <tr key={row.staffId}><td>{row.displayName}</td><td>{row.payrollSnapshotVersion ? payrollRoleLabel(row.payrollRole || null) : "尚未確認上班"}</td><td>{time(row.scheduledStart)}–{time(row.scheduledEnd)}</td><td>{time(row.actualStart)}–{time(row.actualEnd)}</td><td><strong>{row.effectiveMinutes}</strong></td><td>{row.activeServiceCount > 0 ? `${row.activeServiceCount} 筆` : "—"}</td><td>{row.stopAcceptingNewOrders ? "停止新單" : row.hasOpenShift ? "出勤中" : "可接單"}</td>{canManage && !personal && !locked ? <td><AdminButton variant="ghost" onClick={() => { setSelected(row.staffId); setEditing(true); }}>修正</AdminButton></td> : null}</tr>)}</tbody></table></div>
      {!locked && (canManage || personal) ? <details className="adminSettlementDisclosure" open={editing} onToggle={(event) => setEditing(event.currentTarget.open)}>
        <AdminDisclosureSummary>出勤修正與接單操作</AdminDisclosureSummary>
        <div className="adminSettlementDisclosureBody">
          <div className="adminFormGrid">
            {canManage && !personal ? <AdminField label="人員"><select value={selected} disabled={busy || disabled} onChange={event => setSelected(event.target.value)}>{visibleRows.map(row => <option key={row.staffId} value={row.staffId}>{row.displayName}</option>)}</select></AdminField> : null}
            <AdminField label="操作"><select value={action} disabled={busy || disabled} onChange={event => { setAction(event.target.value as Action); setPayrollRole(current?.payrollRole || ""); setStart(""); setEnd(""); }}>{canManage ? <option value="confirm_payroll_role">確認／更正上班計薪職位</option> : null}<option value="clock_in">人工上班</option><option value="clock_out">人工下班</option><option value="add_minutes">增加分鐘</option><option value="subtract_minutes">減少分鐘</option><option value="set_times">修改實際上下班</option><option value="stop_orders">提前離店／停止新單</option><option value="resume_orders">恢復接單</option></select></AdminField>
            {action === "confirm_payroll_role" && canManage ? <div className="adminField"><div className="adminFieldHeading"><label htmlFor={payrollInputId}>上班計薪職位</label><AdminHelp title="更正計薪職位">僅供經理確認既有出勤的職位或更正誤設。須填原因，保留前後值與版本；已正式結算的既有職位不可改寫；舊資料首次確認保留原結算金額。</AdminHelp></div><select id={payrollInputId} value={payrollRole} disabled={busy || disabled} onChange={event => { if (isPayrollRole(event.target.value)) setPayrollRole(event.target.value); }}><option value="">請選擇已核定的上班職位</option>{payrollRoleOptions.filter(option => (option.id !== "manager" || current?.canUseManagerPayrollRole) && (option.id !== "backstage" || current?.canUseBackstage)).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div> : null}
            {needsStart ? <AdminField label={action === "set_times" ? "上班時間" : action === "clock_out" ? "下班時間（留白使用現在）" : "上班時間（留白使用現在）"}><input type="datetime-local" value={start} disabled={busy || disabled} onChange={event => setStart(event.target.value)} /></AdminField> : null}
            {action === "set_times" ? <AdminField label="下班時間"><input type="datetime-local" value={end} disabled={busy || disabled} onChange={event => setEnd(event.target.value)} /></AdminField> : null}
            {needsMinutes ? <AdminField label="分鐘"><input type="number" min="1" value={minutes} disabled={busy || disabled} onChange={event => setMinutes(Number(event.target.value) || 1)} /></AdminField> : null}
            <AdminField label="原因"><input value={reason} disabled={busy || disabled} maxLength={500} onChange={event => setReason(event.target.value)} placeholder="例如服務延後下班" /></AdminField>
          </div>
          {current?.affectedOrders?.length ? <div className="adminAttendanceAffected"><strong>停止新單後的協調清單</strong>{current.affectedOrders.map(order => <div key={order.orderId}><span>{order.orderNumber}{order.customerName ? `｜${order.customerName}` : ""}</span><small>{new Date(order.requestedStart).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })} ～ {time(order.requestedEnd)} · {order.orderStatus}</small></div>)}</div> : null}
          <div className="adminSettlementActionBar"><span>原出勤紀錄與人工修正分別保留。</span><AdminButton onClick={() => void apply()} disabled={busy || disabled || !selectedId || (action === "confirm_payroll_role" && (!payrollRole || !reason.trim()))}>保存出勤操作</AdminButton></div>
        </div>
      </details> : null}
    </>}
    {message ? <p className="adminNotice" role="status">{message}</p> : null}
  </AdminPanel>;
}
