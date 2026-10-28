"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext";
import { ADMIN_NOTIFICATION_CHANGED } from "./admin-events";
import { AdminButton } from "./AdminButton";
import { AdminHelp } from "./AdminHelp";
import { AdminDisclosureSummary } from "./AdminDisclosureSummary";
import { RefreshCw } from "lucide-react";
import { pendingServiceCommands as pendingCommands } from "./order-service-pending";
import { getOrderServiceEligibility, sendOrderServiceCommand } from "./order-service-api";
import type { OrderServiceAction, OrderServiceCommand, OrderServiceEligibility, OrderServiceTarget } from "./order-service-types";

const labels: Record<OrderServiceAction, string> = {
  accept: "整單承接", start_now: "現在開始", backfill_scheduled: "補登開始",
  backfill_custom: "改實際時間", complete: "補登整單",
};
const showTime = (value: string | null) => value ? new Date(value).toLocaleString("zh-TW", {
  timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}) : "未設定";
const localTime = (value: string | null) => value ? new Date(Date.parse(value) + 8 * 3600_000).toISOString().slice(0, 16) : "";
const message = (error: unknown) => error instanceof Error ? error.message : "服務操作失敗，請重新核對。";
// Account-scoped memory survives panel reloads after an uncertain result. Never persist authentication or guest details.


function ReasonButton({ label, accessibleLabel, reason, disabled, busy, onClick }: {
  label: string; accessibleLabel?: string; reason: string; disabled: boolean; busy: boolean; onClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!disabled) return <AdminButton aria-label={accessibleLabel} busy={busy} onClick={onClick}>{label}</AdminButton>;
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger type="button" className="adminButton adminButton-secondary orderServiceUnavailable" aria-disabled="true" aria-label={accessibleLabel}
      openOnHover delay={150} closeDelay={150} onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setOpen(true); }}>
      {label}
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="bottom" align="start" sideOffset={8} className="adminHelpPositioner">
      <Popover.Popup className="adminTheme adminHelpPopup orderServiceReason" initialFocus={false} finalFocus={false}>
        <Popover.Title>目前無法{label}</Popover.Title><Popover.Description>{reason}</Popover.Description>
        <Popover.Close>關閉</Popover.Close>
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}

export function OrderServiceActions({ orderId, refreshKey = "", disabled = false, onChanged, onBusy }: {
  orderId: string; refreshKey?: string; disabled?: boolean; onChanged: () => Promise<void> | void; onBusy?: (busy: boolean) => void;
}) {
  const { user } = useAdminAuth();
  const accountKey = `${user?.id || user?.loginName || "anonymous"}:${orderId}`;
  return <OrderServiceActionsForAccount key={accountKey} accountKey={accountKey} orderId={orderId} refreshKey={refreshKey} disabled={disabled} onChanged={onChanged} onBusy={onBusy} />;
}

function OrderServiceActionsForAccount({ accountKey, orderId, refreshKey, disabled, onChanged, onBusy }: {
  accountKey: string; orderId: string; refreshKey: string; disabled: boolean;
  onChanged: () => Promise<void> | void; onBusy?: (busy: boolean) => void;
}) {
  const [data, setData] = useState<OrderServiceEligibility | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreContentId = useId();
  const [custom, setCustom] = useState<Record<string, { start: string; end: string; progress: string }>>({});
  const [draftTargets, setDraftTargets] = useState<OrderServiceTarget[]>([]);
  const [draftSnapshot, setDraftSnapshot] = useState("");
  const [reason, setReason] = useState("");
  const [retry, setRetry] = useState(() => pendingCommands.get(accountKey) || null);
  const lock = useRef(false);
  const generation = useRef(0);
  const [loadedKey, setLoadedKey] = useState("");
  const loadKey = `${accountKey}:${refreshKey}:${revision}`;
  const ready = loadedKey === loadKey && data?.orderId === orderId;
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    getOrderServiceEligibility(orderId, controller.signal).then((next) => {
      if (controller.signal.aborted || generation.current !== current) return;
      setData(next); setError(""); setLoadedKey(loadKey);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && generation.current === current) { setError(message(error)); setLoadedKey(""); }
    });
    return () => controller.abort();
  }, [orderId, loadKey]);
  useEffect(() => {
    const refresh = () => { if (!lock.current && !customOpen) setRevision(r => r + 1); };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(ADMIN_NOTIFICATION_CHANGED, refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener(ADMIN_NOTIFICATION_CHANGED, refresh); };
  }, [customOpen]);
  useEffect(() => {
    if (!data || customOpen) return;
    const boundaries = data.actions.find(a => a.action === "backfill_scheduled")?.targets
      .flatMap(t => [t.startsAt, t.endsAt]).filter((time): time is string => Boolean(time))
      .map(time => Date.parse(time) - Date.now()).filter(delay => delay > 0 && delay < 15_000) || [];
    if (!boundaries.length) return;
    const timer = window.setTimeout(() => setRevision(r => r + 1), Math.min(...boundaries) + 20);
    return () => window.clearTimeout(timer);
  }, [data, customOpen]);
  const execute = async (action: OrderServiceAction, prepared?: OrderServiceCommand) => {
    if (lock.current || (!prepared && (disabled || !ready || !data))) return;
    if (!prepared && pendingCommands.has(accountKey)) { setRetry(pendingCommands.get(accountKey) || null); return; }
    const command: OrderServiceCommand = prepared || {
      operationId: crypto.randomUUID(), snapshot: action === "backfill_custom" ? draftSnapshot : data!.snapshot, action, reason: action === "backfill_custom" ? reason.trim() : null,
      actualTimes: action === "backfill_custom" ? draftTargets.map(t => ({
        id: t.id, startsAt: `${custom[t.id]?.start}:00+08:00`, endsAt: custom[t.id]?.progress === "completed" ? `${custom[t.id]?.end}:00+08:00` : null,
        stillInProgress: custom[t.id]?.progress === "in_service",
      })) : [],
    };
    lock.current = true; setBusy(true); onBusy?.(true); setError(""); setFeedback("");
    pendingCommands.set(accountKey, command); setRetry(command);
    try {
      await sendOrderServiceCommand(orderId, command);
      pendingCommands.delete(accountKey); setRetry(null); setCustomOpen(false);
      setFeedback(`${labels[action]}已記錄；服務人員、購買時長及帳款歸屬依原訂單保留。`);
      try { await onChanged(); } catch { setError("操作已記錄，但畫面更新失敗，請重讀進度。"); }
    } catch (error: unknown) {
      setError(message(error));
      if (error && typeof error === "object" && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500) {
        pendingCommands.delete(accountKey); setRetry(null);
      }
    } finally { lock.current = false; setBusy(false); onBusy?.(false); setRevision(r => r + 1); }
  };
  const backfill = data?.actions.find(a => a.action === "backfill_scheduled");
  const customAction = data?.actions.find(a => a.action === "backfill_custom");
  const targets = customAction?.targets.filter(t => !t.skipped) || [];
  const allTargets = data?.actions[0]?.targets || [];
  const blockedReason = (action: OrderServiceAction) => {
    if (busy || disabled) return "有其他操作處理中，請稍候。";
    if (retry) return "上一筆結果尚未確認，請先查回同一筆操作。";
    if (!ready) return error || "正在核對全單人員與最新預約。";
    const option = data?.actions.find(a => a.action === action);
    if (!option?.enabled) return [option?.reason || "目前無法執行。", ...(option?.conflicts || []).map(c =>
      `${c.name} · ${showTime(c.startsAt)}–${showTime(c.endsAt)} · 重疊 ${c.overlapMinutes} 分鐘（單號識別 ${c.orderId.slice(0, 8)}）`)].join("\n");
    return "";
  };
  const customInvalid = !reason.trim() || draftTargets.some(t => !custom[t.id]?.start || !custom[t.id]?.progress ||
    custom[t.id]?.progress === "completed" && !custom[t.id]?.end);
  return <Popover.Root open={customOpen} onOpenChange={(open) => { if (!busy && !retry) setCustomOpen(open); }}>
    <section className="orderServiceActions" aria-label="整單指名服務快捷操作">
    <div className="orderServiceHeading"><strong>整單指名服務</strong><AdminHelp title="兩種開始情境">現在才接待，按「整單現在開始」；已按預約開始但忘記按鍵，核對每位時間後按「按預約時間補登」。任一名本單指名人員即可代辦全單，餐點與收款分開處理。</AdminHelp><AdminButton variant="ghost" className="iconActionButton orderServiceRefresh" aria-label="重讀資格" title="重讀資格" disabled={busy || customOpen} onClick={() => setRevision(r => r + 1)}><RefreshCw aria-hidden="true" /></AdminButton></div>
    <p>{allTargets.map(t => t.name).join("／") || "正在核對服務人員…"} · 共 {allTargets.length} 位</p>
    <div className="orderServiceMainActions"><ReasonButton label={labels.accept} reason={blockedReason("accept")} disabled={Boolean(blockedReason("accept"))} busy={busy} onClick={() => void execute("accept")} />
    <details className="orderServiceMore" onToggle={(event) => {
      if (event.currentTarget.open) { setMoreOpen(true); return; }
      if (customOpen && (busy || retry)) { event.currentTarget.open = true; return; }
      setMoreOpen(false);
      setCustomOpen(false);
    }}>
    <AdminDisclosureSummary aria-controls={moreContentId}>更多處理</AdminDisclosureSummary></details></div>
    <div id={moreContentId} className="orderServiceMoreContent" hidden={!moreOpen}>
    {backfill && <ul className="orderServiceTimes">{backfill.targets.map(t => <li key={t.id}>
      <strong>{t.name}</strong><span>{t.skipped ? "已有進度或已結束，本次開始略過" : `按有效預約 ${showTime(t.startsAt)} 開始，服務至 ${showTime(t.endsAt)}，休息至 ${showTime(t.busyUntil)}`}</span>
      <small>{!t.skipped && `若現在開始：${showTime(data?.actions.find(a => a.action === "start_now")?.targets.find(n => n.id === t.id)?.startsAt || null)}–${showTime(data?.actions.find(a => a.action === "start_now")?.targets.find(n => n.id === t.id)?.endsAt || null)}；`}購買 {t.purchasedMinutes} 分鐘 · 休息 {t.restMinutes} 分鐘</small>
    </li>)}</ul>}
    <p className="orderServiceHint">按預約時間補登即表示你確認上述各人確已於該時開始；時間不同請改實際時間。</p>
    <div className="orderServiceButtons">{(["start_now", "backfill_scheduled", "complete"] as const).map(action => {
      const label = labels[action];
      const blocked = blockedReason(action);
      return <ReasonButton key={action} label={label} accessibleLabel={action === "complete" ? "補登整單（完成指名服務）" : action === "start_now" && data?.actions.find(a => a.action === "start_now")?.targets.some(t => !t.skipped && t.status === "waiting") ? "現在開始（承接並開始）" : undefined} reason={blocked} disabled={Boolean(blocked)} busy={busy} onClick={() => void execute(action)} />;
    })}</div>
    <div className="orderServiceButtons">
      {blockedReason("backfill_custom") ? <ReasonButton label="改實際時間" reason={blockedReason("backfill_custom")} disabled busy={busy} onClick={() => {}} /> :
        <Popover.Trigger type="button" className="adminButton adminButton-secondary" onClick={() => {
          setDraftTargets(targets); setDraftSnapshot(data!.snapshot);
          setCustom(Object.fromEntries(targets.map(t => [t.id, custom[t.id] || { start: localTime(t.startsAt), end: "", progress: "" }])));
        }}>改實際時間</Popover.Trigger>}
    </div>
    </div>
      <Popover.Portal><Popover.Positioner side="bottom" align="start" sideOffset={8} className="adminHelpPositioner">
        <Popover.Popup className="adminTheme adminHelpPopup orderServiceEditor">
          <Popover.Title>整單更正實際時間</Popover.Title>
          <Popover.Description>各人保留自己的購買分鐘及休息；超時仍在服務請明確選擇「仍在進行」。</Popover.Description>
          <form onSubmit={(e) => { e.preventDefault(); void execute("backfill_custom"); }}>
            <fieldset disabled={busy || Boolean(retry)}>
              {draftTargets.map(t => <div key={t.id} className="orderServiceActual"><strong>{t.name}</strong>
                <label>實際開始（台灣時間）<input required type="datetime-local" value={custom[t.id]?.start || ""} onChange={e => setCustom(c => ({ ...c, [t.id]: { ...c[t.id], start: e.target.value } }))} /></label>
                <label>目前進度<select required value={custom[t.id]?.progress || ""} onChange={e => setCustom(c => ({ ...c, [t.id]: { ...c[t.id], progress: e.target.value } }))}><option value="">請選擇</option><option value="in_service">仍在進行</option><option value="completed">已完成</option></select></label>
                {custom[t.id]?.progress === "completed" && <label>實際結束（台灣時間）<input required type="datetime-local" value={custom[t.id]?.end || ""} onChange={e => setCustom(c => ({ ...c, [t.id]: { ...c[t.id], end: e.target.value } }))} /></label>}
              </div>)}
              <label>更正原因<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
            </fieldset>
            <AdminButton type="submit" disabled={busy || Boolean(retry) || !ready || customInvalid} busy={busy}>整單補登實際服務</AdminButton>
            {error && <p role="alert" className="adminFormError">{error}</p>}
            {retry && <AdminButton disabled={busy} onClick={() => void execute(retry.action, retry)}>查回／重試同一筆操作</AdminButton>}
            <Popover.Close disabled={busy || Boolean(retry)}>關閉</Popover.Close>
          </form>
        </Popover.Popup>
      </Popover.Positioner></Popover.Portal>
    {error && <p role="alert" className="adminFormError">{error}</p>}
    {feedback && <p role="status">{feedback}</p>}
    {retry && <div role="status"><p>上一筆結果尚未確認，請用同一操作查回。</p><AdminButton disabled={busy} onClick={() => void execute(retry.action, retry)}>查回／重試同一筆操作</AdminButton></div>}
  </section></Popover.Root>;
}
