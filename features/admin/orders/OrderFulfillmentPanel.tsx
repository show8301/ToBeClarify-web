"use client";

import { useEffect, useState } from "react";
import { adminRequest } from "@/features/admin/api/client.js";
import { OrderServiceActions } from "@/features/admin/shared/OrderServiceActions";
import { AdminButton } from "@/features/admin/shared/AdminButton";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { RefreshCw } from "lucide-react";
import { isFulfillmentUnitFinished } from "./fulfillment-progress";
import type { FulfillmentReadState } from "./fulfillment-progress";
import { FulfillmentQuantityField, FulfillmentUnitFields } from "./FulfillmentUnitFields";
import { createFulfillmentTransition, fulfillmentActionNeedsReason, getFulfillmentQuantityLimit, isWholeQuantityTransfer } from "./fulfillment-operation";
import type { FulfillmentDraft, FulfillmentTransitionRequest } from "./fulfillment-operation";

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
  accept: "接單", decline: "無法承接／交回經理", needs_coordination: "等待經理協調", start: "開始", start_now: "進階現在開始（休息／折讓）", backfill: "補登已服務", complete: "完成",
  cancel: "取消未服務項目", reschedule: "改期", carry_forward: "轉入新營業期／保留", waiting: "待接單", accepted: "已接單", in_service: "處理中",
  completed: "已完成", cancelled: "已取消",
  carried_forward: "待跨期",
};
const showTime = (value?: string | null) => value ? new Date(value).toLocaleString("zh-TW", { hour12: false, timeZone: "Asia/Taipei" }) : "—";

export function OrderFulfillmentPanel({ orderId, onChanged, disabled = false, storeConfirmationPending = false, onBusy, onProgressChange, refreshKey = "" }: {
  orderId: string; onChanged: () => Promise<void> | void; disabled?: boolean; onBusy?: (busy: boolean) => void;
  storeConfirmationPending?: boolean; onProgressChange?: (progress: FulfillmentReadState) => void; refreshKey?: string;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [batchBusy, setBatchBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState("");
  const loadKey = `${orderId}:${revision}:${refreshKey}`;
  const ready = loadedFor === loadKey;
  const actionableUnits = storeConfirmationPending
    ? units.map(unit => ({ ...unit, allowedActions: unit.allowedActions.filter(action => action === "cancel") }))
    : units;
  useEffect(() => {
    const controller = new AbortController();
    onProgressChange?.({ kind: "loading" });
    adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment`, { signal: controller.signal })
      .then((data: unknown) => {
        if (controller.signal.aborted) return;
        const next = parseUnits(data);
        if (!data || typeof data !== "object" || !("orderStatus" in data) || typeof data.orderStatus !== "string") throw new Error("無法確認訂單履約狀態。");
        setUnits(next); setError(""); setLoadedFor(loadKey);
        const unfinishedCount = next.filter((unit) => !isFulfillmentUnitFinished(unit)).length;
        onProgressChange?.({ kind: "ready", orderStatus: data.orderStatus, allFinished: next.length > 0 && unfinishedCount === 0, unfinishedCount, totalCount: next.length });
      })
      .catch((e: Error) => { if (!controller.signal.aborted) { setError(e.message); setLoadedFor(loadKey); onProgressChange?.({ kind: "error" }); } });
    return () => controller.abort();
  }, [orderId, revision, loadKey, onProgressChange]);
  const batchMeals = async (action: "accept" | "complete") => {
    if (disabled || storeConfirmationPending || batchBusy || !ready || error) return;
    const candidates = units.filter(unit => unit.kind === "meal" && unit.allowedActions.includes(action));
    if (candidates.length === 0) return;
    setBatchBusy(true); onBusy?.(true); setError("");
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
    finally { setBatchBusy(false); onBusy?.(false); setRevision(n => n + 1); }
  };
  return <section className="adminOrderCard adminOrderFulfillment" aria-label="分項接待進度">
    <header className="adminOrderFulfillmentHeading">
      <div className="adminOrderHeadingWithHelp">
        <h3>餐點與指名分開處理</h3>
        <AdminHelp title="分項接待說明">指名使用整單快捷操作；餐點及包廂仍依各自進度處理。進階折讓須另填原因。</AdminHelp>
      </div>
      <AdminButton variant="ghost" className="iconActionButton" aria-label="重讀履約進度" title="重讀履約進度"
        disabled={disabled || batchBusy || !ready} onClick={() => setRevision(n => n + 1)}><RefreshCw aria-hidden="true" /></AdminButton>
    </header>
    {units.some(unit => unit.kind === "nominee") && <OrderServiceActions orderId={orderId} refreshKey={loadKey} disabled={disabled || batchBusy} onBusy={onBusy} onChanged={async () => { setRevision(n => n + 1); await onChanged(); }} />}
    {!ready && <p role="status">讀取分項履約中…</p>}
    {ready && error && <p role="alert">{error}</p>}
    {actionableUnits.some(unit => unit.kind === "meal" && unit.allowedActions.includes("accept")) || actionableUnits.some(unit => unit.kind === "meal" && unit.allowedActions.includes("complete")) ? <div className="adminPageActions adminOrderFulfillmentActions">
      <AdminButton disabled={disabled || batchBusy || !ready || Boolean(error)} onClick={() => void batchMeals("accept")}>批次接單餐點</AdminButton>
      <AdminButton variant="secondary" disabled={disabled || batchBusy || !ready || Boolean(error)} onClick={() => void batchMeals("complete")}>批次送達已處理餐點</AdminButton>
    </div> : null}
    {actionableUnits.map(unit => <UnitControls key={`${unit.id}-${unit.version}-${storeConfirmationPending}`} orderId={orderId} unit={unit} disabled={disabled || batchBusy || !ready || Boolean(error)} onBusy={onBusy} onChanged={async () => {
      setRevision(n => n + 1);
      await onChanged();
    }} />)}
  </section>;
}

function UnitControls({ orderId, unit, onChanged, disabled, onBusy }: { orderId: string; unit: Unit; onChanged: () => Promise<void>; disabled: boolean; onBusy?: (busy: boolean) => void }) {
  const [draft, setDraft] = useState<FulfillmentDraft>({
    quantity: 1, reason: "", startsAt: "", targetBusinessPeriodId: "",
    actualStartsAt: "", actualEndsAt: "", restMinutes: unit.restMinutesReserved || 0,
    compensationAmount: 0, compensationReason: "",
  });
  const updateDraft = (patch: Partial<FulfillmentDraft>) => setDraft(current => ({ ...current, ...patch }));
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [periodsReady, setPeriodsReady] = useState(false);
  const [periodsError, setPeriodsError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [completionTime, setCompletionTime] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (activeAction !== "complete" || !unit.scheduledEndsAt) return;
    const remaining = Date.parse(unit.scheduledEndsAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 2147483600) return;
    const timer = setTimeout(() => setCompletionTime(Date.now()), remaining + 25);
    return () => clearTimeout(timer);
  }, [activeAction, unit.scheduledEndsAt]);
  useEffect(() => {
    if (!unit.allowedActions.includes("reschedule") && !unit.allowedActions.includes("carry_forward")) return;
    const controller = new AbortController();
    adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment/period-options`, { signal: controller.signal })
      .then((value: unknown) => {
        if (!Array.isArray(value)) throw new Error("營業期資料格式不正確。");
        const options: PeriodOption[] = value.map((entry: unknown) => {
          if (!entry || typeof entry !== "object" || !("id" in entry) || !("businessDate" in entry) || !("status" in entry) ||
              typeof entry.id !== "string" || typeof entry.businessDate !== "string" || typeof entry.status !== "string") throw new Error("營業期資料格式不正確。");
          return { id: entry.id, businessDate: entry.businessDate, status: entry.status };
        });
        if (!controller.signal.aborted) {
          setPeriods(options);
          setPeriodsReady(true);
          setPeriodsError("");
        }
      }).catch(() => {
        if (!controller.signal.aborted) {
          setPeriods([]);
          setPeriodsReady(true);
          setPeriodsError("無法讀取可履約營業期，請重讀履約進度後再試。");
        }
      });
    return () => controller.abort();
  }, [orderId, unit.allowedActions, unit.id]);
  const [retry, setRetry] = useState<FulfillmentTransitionRequest | null>(null);

  const run = async (action: string) => {
    if (disabled || busy) return;
    if (!retry) {
      const validation = disabledReason(action);
      if (validation) { setError(validation); return; }
    }
    const body = retry ?? createFulfillmentTransition(unit, action, draft, crypto.randomUUID());
    onBusy?.(true); setBusy(true); setPendingAction(retry ? `retry:${action}` : action); setRetry(body);
    try {
      await adminRequest(`/orders/${encodeURIComponent(orderId)}/fulfillment/${encodeURIComponent(unit.id)}/transition`, { method: "POST", body: JSON.stringify(body) });
      setRetry(null); setError(""); await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) setRetry(null);
    } finally { setBusy(false); onBusy?.(false); setPendingAction(null); }
  };
  const earlyCompletion = (unit.kind === "nominee" || unit.kind === "addon")
    && Boolean(unit.scheduledEndsAt && Date.parse(unit.scheduledEndsAt) > completionTime);
  const disabledReason = (action: string, openingEditor = false) => {
    if (disabled || busy) return "操作處理中，請稍候。";
    if (retry) return "上一筆操作結果尚未確認，請先查回或重試同一筆操作。";
    const quantity = isWholeQuantityTransfer(unit, action) ? getFulfillmentQuantityLimit(unit, action) : draft.quantity;
    const max = getFulfillmentQuantityLimit(unit, action);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > max) return "本次可處理數量為 1–" + max + " 份，請調整數量。";
    if (openingEditor) return undefined;
    if (fulfillmentActionNeedsReason(action) && !draft.reason.trim()) return "請先填寫操作原因。";
    if (action === "complete" && earlyCompletion && !draft.reason.trim()) return "提早完成請填寫操作原因。";
    if (action === "backfill" && !draft.actualStartsAt) return "補登請填寫實際開始時間。";
    if (action === "reschedule" && unit.kind === "nominee" && !draft.startsAt) return "請先填寫改期開始時間。";
    if (action === "carry_forward" && draft.targetBusinessPeriodId && unit.kind === "nominee" && !draft.startsAt) return "請先填寫跨期履約開始時間。";
    if (action === "start_now" && draft.compensationAmount > 0 && !draft.compensationReason.trim()) return "有折讓時請填寫折讓原因。";
    return undefined;
  };
  const openEditor = (action: string, selectedAt: number) => {
    if (disabled || busy || retry) return;
    setActiveAction(action);
    setCompletionTime(selectedAt);
    setMoreOpen(true);
    setError("");
  };
  const availableActions = unit.allowedActions.filter(action => unit.kind !== "nominee" || !["accept", "start", "backfill"].includes(action));
  const dailyActions = availableActions.filter(action => ["accept", "start", "complete"].includes(action));
  const advancedActions = availableActions.filter(action => !dailyActions.includes(action));
  const unfinished = !isFulfillmentUnitFinished(unit);
  const metrics = [
    { label: "共", value: unit.quantity, total: true },
    { label: "已接", value: unit.acceptedQuantity },
    { label: "處理中", value: unit.startedQuantity - unit.completedQuantity },
    { label: "完成", value: unit.completedQuantity },
    { label: "取消", value: unit.cancelledQuantity },
  ];
  return <fieldset className={"adminOrderEmergency adminOrderFulfillmentUnit" + (unfinished ? " isUnfinished" : "")}
    aria-label={unit.name + "履約操作"} disabled={disabled || busy}>
    <header className="adminOrderUnitHeading">
      <strong>{unit.name}</strong>
      <span className={"adminOrderUnitStatus" + (unit.status === "completed" ? " isComplete" : "")}>
        {labels[unit.status] || unit.status}
      </span>
    </header>
    <dl className="adminFulfillmentMetrics">
      {metrics.map(metric => <div key={metric.label} className={metric.value === 0 ? "isZero" : ""}>
        <dt>{metric.label}</dt><dd>{metric.value}{metric.total ? " 份／項" : ""}</dd>
      </div>)}
    </dl>
    {unit.purchasedMinutes > 0 && <p className="adminFulfillmentSchedule">購買服務 {unit.purchasedMinutes} 分鐘</p>}
    {unit.originalScheduledStartsAt && <p className="adminFulfillmentSchedule">
      原預約 {showTime(unit.originalScheduledStartsAt)}～{showTime(unit.originalScheduledEndsAt)}
      <AdminHelp title="原預約與休息說明">{"原預約時間會保留供核對；原預留休息 " + unit.restMinutesReserved + " 分鐘。"}</AdminHelp>
    </p>}
    {unit.allowedActions.length > 0 && <div className="adminFulfillmentDailyBar">
      {dailyActions.length > 0 && <>
        <FulfillmentQuantityField value={draft.quantity} max={unit.quantity} fixed={unit.quantity === 1}
          disabled={disabled || busy || Boolean(retry)} onChange={quantity => updateDraft({ quantity })} />
        <div className="adminFulfillmentDailyActions">
          {dailyActions.map((action, index) => <AdminButton key={action}
            variant={index === 0 ? "primary" : "secondary"}
            busy={pendingAction === action}
            busyLabel="處理中…"
            disabledReason={disabledReason(action, true)}
            disabled={Boolean(disabledReason(action, true))}
            onClick={() => {
              if (action === "start_now" || (action === "complete" && (unit.kind === "nominee" || unit.kind === "addon"))) openEditor(action, Date.now());
              else void run(action);
            }}>{labels[action] || action}</AdminButton>)}
        </div>
      </>}
      {(advancedActions.length > 0 || activeAction) && <details className="adminFulfillmentMore" open={moreOpen}
        onToggle={event => setMoreOpen(event.currentTarget.open)}>
        <AdminDisclosureSummary>更多處理</AdminDisclosureSummary>
        <div className="adminFulfillmentMoreContent">
          {advancedActions.length > 0 && <div className="adminFulfillmentAdvancedActions" role="group" aria-label="選擇進階處理">
            {advancedActions.map(action => <AdminButton key={action} variant={action === "cancel" ? "danger" : "secondary"}
              aria-pressed={activeAction === action} disabled={disabled || busy || Boolean(retry)}
              onClick={() => openEditor(action, Date.now())}>{labels[action] || action}</AdminButton>)}
          </div>}
          {activeAction && <div className="adminFulfillmentEditor">
            <div className="adminFulfillmentEditorHeading">
              <h4>{labels[activeAction] || activeAction}</h4>
              <AdminButton variant="ghost" disabled={busy || Boolean(retry)} onClick={() => setActiveAction(null)}>關閉表單</AdminButton>
            </div>
            <FulfillmentUnitFields unit={unit} action={activeAction} draft={draft} periods={periods}
              periodsLoading={!periodsReady} periodsError={periodsError}
              completionReasonRequired={activeAction === "complete" && earlyCompletion}
              disabled={disabled || busy || Boolean(retry)} onChange={updateDraft} />
            <div className="adminFulfillmentEditorActions">
              <AdminButton variant={activeAction === "cancel" ? "danger" : "primary"}
                busy={pendingAction === activeAction} busyLabel="處理中…"
                disabledReason={disabledReason(activeAction)}
                disabled={Boolean(disabledReason(activeAction))}
                onClick={() => void run(activeAction)}>
                {activeAction === "start_now" ? "確認進階現在開始" : "確認" + (labels[activeAction] || activeAction)}
              </AdminButton>
            </div>
          </div>}
        </div>
      </details>}
    </div>}
    {error && <p className="adminFulfillmentNotice isError" role="alert">{error}</p>}
    {retry && (!busy || pendingAction === "retry:" + retry.action) && <div className="adminFulfillmentNotice" role="status">
      <p>上一筆操作結果尚未確認；草稿已保留，請查回同一筆操作。</p>
      <AdminButton busy={pendingAction === "retry:" + retry.action} busyLabel="查回中…" disabled={busy}
        onClick={() => void run(retry.action)}>查回／重試同一筆操作</AdminButton>
    </div>}
  </fieldset>;
}
