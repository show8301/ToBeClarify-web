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
  allowedActions: string[];
}
function parseUnits(value: unknown): Unit[] {
  if (!value || typeof value !== "object" || !("units" in value) || !Array.isArray(value.units)) throw new Error("無法讀取接待進度。");
  return value.units.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("接待資料格式有誤。");
    const u = Object.fromEntries(Object.entries(entry));
    for (const key of ["id", "name", "kind", "status"]) if (typeof u[key] !== "string") throw new Error("接待資料格式有誤。");
    for (const key of ["quantity", "acceptedQuantity", "startedQuantity", "completedQuantity", "cancelledQuantity", "version", "purchasedMinutes"]) {
      if (typeof u[key] !== "number" || !Number.isSafeInteger(u[key])) throw new Error("接待數量有誤。");
    }
    if (!Array.isArray(u.allowedActions) || !u.allowedActions.every(a => typeof a === "string")) throw new Error("接待操作格式有誤。");
    return u as unknown as Unit;
  });
}
const labels: Record<string, string> = {
  accept: "接單", start: "開始", complete: "完成", cancel: "取消未服務項目", reschedule: "改期",
  waiting: "待接單", accepted: "已接單", in_service: "處理中", completed: "已完成", cancelled: "已取消",
};

export function OrderFulfillmentPanel({ orderId, onChanged }: { orderId: string; onChanged: () => Promise<void> | void }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment`, { signal: controller.signal })
      .then((data: unknown) => { setUnits(parseUnits(data)); setError(""); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [orderId, revision]);
  return <section className="adminOrderCard" aria-label="分項接待進度">
    <h3>餐點與指名分開處理</h3>
    {error && <p role="alert">{error}</p>}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<{ operationId: string; expectedVersion: number; action: string; quantity: number; reason: string | null; scheduledStartsAt: string | null } | null>(null);
  const run = async (action: string) => {
    const body = retry ?? { operationId: crypto.randomUUID(), expectedVersion: unit.version, action, quantity,
      reason: reason.trim() || null, scheduledStartsAt: startsAt ? `${startsAt}:00+08:00` : null };
    setBusy(true);
    setRetry(body);
    try {
      await adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment/${encodeURIComponent(unit.id)}/transition`, {
        method: "POST", body: JSON.stringify(body),
      });
      setRetry(null);
      setError("");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) setRetry(null);
    } finally { setBusy(false); }
  };
  return <div className="adminOrderEmergency">
    <strong>{unit.name} · {labels[unit.status] || unit.status}</strong>
    <p>共 {unit.quantity} 份／項 · 已接 {unit.acceptedQuantity} · 處理中 {unit.startedQuantity - unit.completedQuantity} · 完成 {unit.completedQuantity} · 取消 {unit.cancelledQuantity}{unit.purchasedMinutes > 0 ? ` · 購買 ${unit.purchasedMinutes} 分鐘` : ""}</p>
    {unit.allowedActions.length > 0 && <>
      {unit.quantity > 1 && <label>本次數量<input type="number" min="1" max={unit.quantity} value={quantity} disabled={!!retry} onChange={e => setQuantity(Number(e.target.value))} /></label>}
      <label>原因（取消、改期、提早完成時填寫）<input value={reason} maxLength={500} disabled={!!retry} onChange={e => setReason(e.target.value)} /></label>
      {unit.allowedActions.includes("reschedule") && <label>改期開始時間（台灣時間）<input type="datetime-local" value={startsAt} disabled={!!retry} onChange={e => setStartsAt(e.target.value)} /></label>}
      <div className="adminPageActions">{unit.allowedActions.map(action => <button type="button" key={action}
        disabled={busy || !!retry || ((action === "cancel" || action === "reschedule") && !reason.trim()) || (action === "reschedule" && !startsAt)} onClick={() => void run(action)}>{labels[action]}</button>)}</div>
    </>}
    {error && <p role="alert">{error}</p>}
    {retry && <button type="button" disabled={busy} onClick={() => void run(retry.action)}>查回／重試同一筆操作</button>}
  </div>;
}
