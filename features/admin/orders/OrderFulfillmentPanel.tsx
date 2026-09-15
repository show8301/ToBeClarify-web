"use client";

import { useEffect, useState } from "react";
import { adminRequest } from "@/features/admin/api/client.js";

interface Unit {
  id: string;
  name: string;
  kind: string;
  status: string;
  quantity: number;
  acceptedQuantity: number;
  startedQuantity: number;
  completedQuantity: number;
  cancelledQuantity: number;
  version: number;
  purchasedMinutes: number;
  scheduledStartsAt?: string | null;
  scheduledEndsAt?: string | null;
  originalScheduledStartsAt?: string | null;
  originalScheduledEndsAt?: string | null;
  restMinutesReserved: number;
  allowedActions: string[];
}

interface Preview {
  originalStartsAt: string;
  effectiveStartsAt: string;
  effectiveEndsAt: string;
  purchasedMinutes: number;
  originalRestMinutes: number;
  restMinutesReserved: number;
  conflicts: Array<{ unitId: string; name: string; overlapMinutes: number; startsAt?: string | null; endsAt?: string | null; status: string }>;
  canStartNow: boolean;
}
interface PeriodOption { id: string; businessDate: string; status: string; }

function parseUnits(value: unknown): Unit[] {
  if (!value || typeof value !== "object" || !("units" in value) || !Array.isArray(value.units)) throw new Error("無法讀取接待進度。");
  return value.units.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("接待資料格式有誤。");
    const u = Object.fromEntries(Object.entries(entry));
    for (const key of ["id", "name", "kind", "status"]) if (typeof u[key] !== "string") throw new Error("接待資料格式有誤。");
    for (const key of ["quantity", "acceptedQuantity", "startedQuantity", "completedQuantity", "cancelledQuantity", "version", "purchasedMinutes", "restMinutesReserved"]) {
      if (typeof u[key] !== "number" || !Number.isSafeInteger(u[key])) throw new Error("接待數量有誤。");
    }
    if (!Array.isArray(u.allowedActions) || !u.allowedActions.every(a => typeof a === "string")) throw new Error("接待操作格式有誤。");
    return u as unknown as Unit;
  });
}

const labels: Record<string, string> = {
  accept: "接單", start: "開始", start_now: "預覽現在接待", backfill: "補登已服務", complete: "完成",
  cancel: "取消未服務項目", reschedule: "改期", carry_forward: "轉入新營業期", waiting: "待接單", accepted: "已接單", in_service: "處理中",
  completed: "已完成", cancelled: "已取消",
};
const showTime = (value?: string | null) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false }) : "—";

export function OrderFulfillmentPanel({ orderId, onChanged }: { orderId: string; onChanged: () => Promise<void> | void }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [batchBusy, setBatchBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment`, { signal: controller.signal })
      .then((data: unknown) => { setUnits(parseUnits(data)); setError(""); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [orderId, revision]);
  const batchMeals = async (action: "accept" | "complete") => {
    const candidates = units.filter(unit => unit.kind === "meal" && unit.allowedActions.includes(action));
    if (candidates.length === 0) return;
    setBatchBusy(true); setError("");
    try {
      for (const unit of candidates) {
        const quantity = action === "accept"
          ? unit.quantity - unit.cancelledQuantity - unit.acceptedQuantity
          : unit.startedQuantity - unit.completedQuantity;
        if (quantity < 1) continue;
        await adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment/${encodeURIComponent(unit.id)}/transition`, {
          method: "POST",
          body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: unit.version, action, quantity, reason: "批次餐點作業", restMinutes: -1, compensationAmount: 0 })
        });
      }
      setRevision(n => n + 1); await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "批次餐點操作失敗"); }
    finally { setBatchBusy(false); }
  };
  return <section className="adminOrderCard" aria-label="分項接待進度">
    <h3>餐點與指名分開處理</h3>
    <p>原預約時間會保留；晚開始可在這裡保留完整購買分鐘並調整休息，折讓會同次寫入帳務。</p>
    {error && <p role="alert">{error}</p>}
    {units.some(unit => unit.kind === "meal" && unit.allowedActions.includes("accept")) || units.some(unit => unit.kind === "meal" && unit.allowedActions.includes("complete")) ? <div className="adminPageActions"><button type="button" disabled={batchBusy} onClick={() => void batchMeals("accept")}>批次接單餐點</button><button type="button" disabled={batchBusy} onClick={() => void batchMeals("complete")}>批次送達已處理餐點</button></div> : null}
    {units.map(unit => <UnitControls key={`${unit.id}-${unit.version}`} orderId={orderId} unit={unit} onChanged={async () => {
      setRevision(n => n + 1);
      await onChanged();
    }} />)}
  </section>;
}

function UnitControls({ orderId, unit, onChanged }: { orderId: string; unit: Unit; onChanged: () => Promise<void> }) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [targetBusinessPeriodId, setTargetBusinessPeriodId] = useState("");
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [actualStartsAt, setActualStartsAt] = useState("");
  const [actualEndsAt, setActualEndsAt] = useState("");
  const [restMinutes, setRestMinutes] = useState(unit.restMinutesReserved || 0);
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [compensationReason, setCompensationReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!unit.allowedActions.includes("reschedule") && !unit.allowedActions.includes("carry_forward")) return;
    adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment/period-options`)
      .then(value => { if (Array.isArray(value)) setPeriods(value as PeriodOption[]); })
      .catch(() => setPeriods([]));
  }, [orderId, unit.allowedActions, unit.id]);
  type RequestBody = { operationId: string; expectedVersion: number; action: string; quantity: number; reason: string | null; scheduledStartsAt: string | null; targetBusinessPeriodId: string | null; restMinutes: number; compensationAmount: number; compensationReason: string | null; actualStartsAt: string | null; actualEndsAt: string | null };
  const [retry, setRetry] = useState<RequestBody | null>(null);

  const loadPreview = async () => {
    setBusy(true); setError("");
    try {
      const value = await adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment/${encodeURIComponent(unit.id)}/start-preview`) as Preview;
      setPreview(value);
    } catch (e) { setError(e instanceof Error ? e.message : "無法預覽現在接待"); }
    finally { setBusy(false); }
  };
  const run = async (action: string) => {
    if (action === "start_now" && !preview) { await loadPreview(); return; }
    if (action === "backfill" && !actualStartsAt) { setError("補登請填寫實際開始時間。"); return; }
    const body: RequestBody = retry ?? { operationId: crypto.randomUUID(), expectedVersion: unit.version, action, quantity,
      reason: reason.trim() || null, scheduledStartsAt: startsAt ? `${startsAt}:00+08:00` : null,
      targetBusinessPeriodId: targetBusinessPeriodId || null, restMinutes: action === "start_now" ? restMinutes : -1,
      compensationAmount, compensationReason: compensationReason.trim() || null,
      actualStartsAt: actualStartsAt ? `${actualStartsAt}:00+08:00` : null,
      actualEndsAt: actualEndsAt ? `${actualEndsAt}:00+08:00` : null };
    setBusy(true); setRetry(body);
    try {
      await adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment/${encodeURIComponent(unit.id)}/transition`, { method: "POST", body: JSON.stringify(body) });
      setRetry(null); setPreview(null); setError(""); await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) setRetry(null);
    } finally { setBusy(false); }
  };
  return <div className="adminOrderEmergency">
    <strong>{unit.name} · {labels[unit.status] || unit.status}</strong>
    <p>共 {unit.quantity} 份／項 · 已接 {unit.acceptedQuantity} · 處理中 {unit.startedQuantity - unit.completedQuantity} · 完成 {unit.completedQuantity} · 取消 {unit.cancelledQuantity}{unit.purchasedMinutes > 0 ? ` · 購買 ${unit.purchasedMinutes} 分鐘` : ""}</p>
    {unit.originalScheduledStartsAt && <p>原預約：{showTime(unit.originalScheduledStartsAt)}～{showTime(unit.originalScheduledEndsAt)} · 預留休息 {unit.restMinutesReserved} 分鐘</p>}
    {unit.allowedActions.length > 0 && <>
      {unit.quantity > 1 && <label>本次數量<input type="number" min="1" max={unit.quantity} value={quantity} disabled={!!retry} onChange={e => setQuantity(Number(e.target.value))} /></label>}
      <label>原因（取消、改期、提早完成、補登時填寫）<input value={reason} maxLength={500} disabled={!!retry} onChange={e => setReason(e.target.value)} /></label>
      {(unit.allowedActions.includes("reschedule") || unit.allowedActions.includes("carry_forward")) && <><label>{unit.allowedActions.includes("carry_forward") ? "新履約開始時間（台灣時間）" : "改期開始時間（台灣時間）"}<input type="datetime-local" value={startsAt} disabled={!!retry} onChange={e => setStartsAt(e.target.value)} /></label><label>履約營業期（跨期時選擇）<select value={targetBusinessPeriodId} disabled={!!retry} onChange={e => setTargetBusinessPeriodId(e.target.value)}><option value="">沿用原營業期</option>{periods.map(period => <option key={period.id} value={period.id}>{period.businessDate}（{period.status === "coordination" ? "協調" : "營業中"}）</option>)}</select></label></>}
      {unit.allowedActions.includes("backfill") && <div><label>實際開始<input type="datetime-local" value={actualStartsAt} disabled={!!retry} onChange={e => setActualStartsAt(e.target.value)} /></label><label>實際結束（已完成才填）<input type="datetime-local" value={actualEndsAt} disabled={!!retry} onChange={e => setActualEndsAt(e.target.value)} /></label></div>}
      {unit.allowedActions.includes("start_now") && <div><p>現在接待設定</p><label><input type="radio" checked={restMinutes === unit.restMinutesReserved} disabled={!!retry} onChange={() => setRestMinutes(unit.restMinutesReserved)} />保留原休息 {unit.restMinutesReserved} 分鐘</label><label><input type="radio" checked={restMinutes === 0} disabled={!!retry} onChange={() => setRestMinutes(0)} />本次不占休息（可折讓）</label><label>折讓金額<input type="number" min="0" value={compensationAmount} disabled={!!retry} onChange={e => setCompensationAmount(Math.max(0, Number(e.target.value)))} /></label><label>折讓／待確認原因<input value={compensationReason} maxLength={500} disabled={!!retry} onChange={e => setCompensationReason(e.target.value)} /></label></div>}
      {preview && <div role="status"><p>現在接待：{showTime(preview.effectiveStartsAt)} 開始，服務至 {showTime(preview.effectiveEndsAt)}，購買 {preview.purchasedMinutes} 分鐘。</p>{preview.conflicts.length > 0 && <p>會影響：{preview.conflicts.map(c => `${c.name}（重疊 ${c.overlapMinutes} 分鐘）`).join("、")}；開始後這些單會轉待協調。</p>}{!preview.canStartNow && <p>此店員仍有進行中的服務，請先完成該服務。</p>}<button type="button" disabled={busy || !!retry || !preview.canStartNow} onClick={() => void run("start_now")}>確認現在接待</button></div>}
      <div className="adminPageActions">{unit.allowedActions.filter(action => action !== "start_now").map(action => <button type="button" key={action} disabled={busy || !!retry || ((action === "cancel" || action === "reschedule" || action === "carry_forward") && !reason.trim()) || ((action === "reschedule" || action === "carry_forward") && unit.kind === "nominee" && !startsAt) || (action === "carry_forward" && !targetBusinessPeriodId)} onClick={() => void run(action)}>{labels[action]}</button>)}{unit.allowedActions.includes("start_now") && !preview && <button type="button" disabled={busy || !!retry} onClick={() => void run("start_now")}>{labels.start_now}</button>}</div>
    </>}
    {error && <p role="alert">{error}</p>}
    {retry && <button type="button" disabled={busy} onClick={() => void run(retry.action)}>查回／重試同一筆操作</button>}
  </div>;
}
