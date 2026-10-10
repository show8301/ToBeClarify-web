"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi, adminRequest } from "@/features/admin/api/client.js";
import { AdminButton, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { formatClock } from "./operationsFormat";
import { errorText, fulfillmentPath, list, record, textValue, workbenchApi } from "./workbenchApi";
import type { StartPreview, WorkbenchUnit } from "./workbenchApi";
import type { OperationsNominee, OperationsOrder } from "./operationsTypes";

export type ServiceEntry = { order: OperationsOrder; nominee: OperationsNominee; unit: WorkbenchUnit | null; status: string };
export type ServiceAction = "accept" | "decline" | "start" | "start_now" | "complete" | "cancel" | "reschedule" | "backfill" | "carry_forward" | "shorten";
export const serviceActionLabels: Record<ServiceAction, string> = {
  accept: "確認承接", decline: "無法承接", start_now: "開始服務", complete: "完成服務",
  cancel: "取消未服務項目", reschedule: "調整時間", backfill: "補登已服務", carry_forward: "保留／轉入新營業期", shorten: "縮短未開始服務",
  start: "開始加購服務",
};

export function WorkbenchServiceDialog({ entry, action, onSaved, onBusy }: {
  entry: ServiceEntry; action: ServiceAction; onSaved: () => Promise<void>; onBusy: (busy: boolean) => void;
}) {
  const { order, nominee, unit } = entry;
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [actualEnd, setActualEnd] = useState("");
  const [targetPeriod, setTargetPeriod] = useState("");
  const [segments, setSegments] = useState(Math.max(nominee.minimumSegments || 1, nominee.segmentCount - 1));
  const [periods, setPeriods] = useState<Array<{ id: string; date: string }>>([]);
  const [preview, setPreview] = useState<StartPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState(action !== "start_now" || !unit);
  const lock = useRef(false);
  // Keep the exact operation after an uncertain network result; a retry never creates a second mutation.
  const retry = useRef<{ path: string; body: string } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (action === "start_now" && unit) {
      workbenchApi.preview(order.id, unit.id, controller.signal).then((value) => {
        if (!controller.signal.aborted) { setPreview(value); setPrepared(true); }
      }).catch((e: unknown) => { if (!controller.signal.aborted) setError(errorText(e)); });
    }
    if (action === "carry_forward" && unit) {
      adminRequest(`${fulfillmentPath(order.id)}/period-options`, { signal: controller.signal }).then((value: unknown) => {
        const options = list(value, (item) => { const p = record(item); return { id: textValue(p.id), date: textValue(p.businessDate) }; });
        if (!controller.signal.aborted) setPeriods(options);
      }).catch((e: unknown) => { if (!controller.signal.aborted) setError(errorText(e)); });
    }
    return () => controller.abort();
  }, [action, order.id, unit]);
  const early = action === "complete" && Date.parse(unit?.scheduledEndsAt || nominee.requestedServiceEndsAt) > now;
  const requiredReason = ["decline", "cancel", "reschedule", "backfill", "carry_forward", "shorten"].includes(action) || early;
  const requiresStart = action === "reschedule" || action === "backfill" || action === "carry_forward" && Boolean(targetPeriod);
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      if (retry.current) {
        await adminRequest(retry.current.path, { method: "POST", body: retry.current.body });
      } else if (action === "shorten") {
        await adminApi.shortenNomination(order.id, nominee.id, segments, reason.trim());
      } else if (!unit && action === "reschedule") {
        await adminApi.rescheduleOrder(order.id, `${startsAt}:00+08:00`);
      } else if (!unit && action !== "accept" && action !== "decline") {
        await adminApi.transitionOrder(order.id, action === "start_now" ? "start" : action, reason.trim() || null);
      } else {
        const response = action === "accept" || action === "decline";
        const path = response
          ? `/orders/${encodeURIComponent(order.id)}/nominees/${encodeURIComponent(nominee.id)}/response`
          : `${fulfillmentPath(order.id, unit?.id)}/transition`;
        const body = response ? {
          operationId: crypto.randomUUID(), expectedVersion: unit?.version || 0, decision: action, reason: reason.trim() || null,
        } : {
          operationId: crypto.randomUUID(), expectedVersion: unit?.version, action, quantity: 1,
          reason: reason.trim() || null, restMinutes: -1, compensationAmount: 0,
          scheduledStartsAt: action === "reschedule" || action === "carry_forward" ? startsAt ? `${startsAt}:00+08:00` : null : null,
          targetBusinessPeriodId: targetPeriod || null,
          actualStartsAt: action === "backfill" ? `${startsAt}:00+08:00` : null,
          actualEndsAt: action === "backfill" && actualEnd ? `${actualEnd}:00+08:00` : null,
        };
        retry.current = { path, body: JSON.stringify(body) };
        await adminRequest(path, { method: "POST", body: retry.current.body });
      }
      retry.current = null; setRetrying(false);
      await onSaved();
    } catch (e) {
      setError(errorText(e));
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) retry.current = null;
      setRetrying(Boolean(retry.current));
    } finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <form className="dwForm" onSubmit={(e) => { e.preventDefault(); void save(); }}>
    <p className="dwHint">{order.customerName} · {nominee.serviceName} · {formatClock(unit?.scheduledStartsAt || nominee.requestedStartsAt)}–{formatClock(unit?.scheduledEndsAt || nominee.requestedServiceEndsAt)}</p>
    {action === "decline" && <p className="dwNotice">這筆指名交回經理協調。顧客訂單、餐點及金額會保留。</p>}
    {early && <p className="dwNotice">目前尚未到預定結束時間。提早完成需填寫原因，金額不會自動減少。</p>}
    {action === "start_now" && !prepared && <p role="status">讀取現在接待的時間與衝突…</p>}
    {preview && <div className="dwNotice">
      <p>現在開始 {formatClock(preview.effectiveStartsAt)}，服務至 {formatClock(preview.effectiveEndsAt)}。</p>
      <p>保留購買 {preview.purchasedMinutes} 分鐘及休息 {preview.restMinutesReserved} 分鐘。</p>
      {preview.conflicts.length > 0 && <p>以下服務會轉為待協調：{preview.conflicts.join("、")}。</p>}
      {!preview.canStartNow && <p>仍有其他服務進行中，請先完成該服務。</p>}
    </div>}
    <fieldset disabled={busy || retrying}>
      {action === "carry_forward" && <AdminField label="目標營業期"><select value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value)}><option value="">保留，等待安排</option>{periods.filter((p) => p.id !== unit?.fulfillmentPeriodId).map((p) => <option key={p.id} value={p.id}>{p.date}</option>)}</select></AdminField>}
      {(requiresStart || action === "carry_forward") && <AdminField label={action === "backfill" ? "實際開始（台灣時間）" : "新開始時間（台灣時間）"} required={requiresStart}><input type="datetime-local" required={requiresStart} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></AdminField>}
      {action === "backfill" && <AdminField label="實際結束（已完成才填寫）"><input type="datetime-local" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} /></AdminField>}
      {action === "shorten" && <AdminField label="縮短為幾節" required><input required type="number" min={nominee.minimumSegments || 1} max={nominee.segmentCount - 1} value={segments} onChange={(e) => setSegments(Number(e.target.value))} /></AdminField>}
      {(requiredReason || action === "complete") && <AdminField label="原因" required={requiredReason}><textarea rows={3} maxLength={500} required={requiredReason} value={reason} onChange={(e) => setReason(e.target.value)} /></AdminField>}
    </fieldset>
    {error && <p className="adminFormError" role="alert">{error}</p>}
    <AdminButton type="submit" disabled={busy || !prepared || preview?.canStartNow === false || !retrying && requiredReason && !reason.trim()}>{busy ? "處理中…" : retrying ? "查回／重試同一筆操作" : serviceActionLabels[action]}</AdminButton>
  </form>;
}
