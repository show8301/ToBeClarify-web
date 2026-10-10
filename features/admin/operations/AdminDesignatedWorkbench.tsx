"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, adminRequest } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { canAct as canActAt, legacyStandalone, resolveServiceStatus } from "./workbenchRules";
import { WorkbenchShiftBar } from "./WorkbenchShiftBar";
import { WorkbenchOrderComposer } from "./WorkbenchOrderComposer";
import { WorkbenchAddonForm } from "./WorkbenchAddonForm";
import { WorkbenchDeliveryAction, WorkbenchDepartureAction, WorkbenchPassAction } from "./WorkbenchGuestActions";
import { WorkbenchServiceDialog, serviceActionLabels } from "./WorkbenchServiceDialog";
import { errorText, fulfillmentPath, serviceStatusLabels, workbenchApi } from "./workbenchApi";
import { formatClock, orderStatusLabel } from "./operationsFormat";
import type { ComposerMode } from "./WorkbenchOrderComposer";
import type { ServiceAction, ServiceEntry } from "./WorkbenchServiceDialog";
import type { WorkbenchUnit } from "./workbenchApi";
import type { CurrentAdminUser, OperationsData, OperationsOrder, OperationsSession } from "./operationsTypes";

type DialogTarget =
  | { kind: "service"; entry: ServiceEntry; action: ServiceAction }
  | { kind: "addon"; entry: ServiceEntry }
  | { kind: "composer"; session: OperationsSession; mode: ComposerMode }
  | { kind: "delivery"; session: OperationsSession; orderId: string }
  | { kind: "pass" | "departure"; session: OperationsSession };

const composerTitles: Record<ComposerMode, string> = { meals: "代點餐點", rooms: "代客訂購包廂", renew: "建立續時指名", transfer: "經理建立承接請求" };
const startTime = (entry: ServiceEntry) => entry.unit?.scheduledStartsAt || entry.nominee.requestedStartsAt;
const endTime = (entry: ServiceEntry) => entry.unit?.scheduledEndsAt || entry.nominee.requestedServiceEndsAt;
function badge(status: string) { return <span className={`dwBadge is-${status}`}>{serviceStatusLabels[status] || orderStatusLabel(status)}</span>; }

export function AdminDesignatedWorkbench({ data, user, onChanged, loading, loadError }: {
  data: OperationsData; user: CurrentAdminUser; onChanged: () => Promise<void>; loading: boolean; loadError: string;
}) {
  const [units, setUnits] = useState<Record<string, WorkbenchUnit[]>>({});
  const [unitsSource, setUnitsSource] = useState<OperationsOrder[] | null>(null);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [unitsError, setUnitsError] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const dialogBusyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [addonBusyId, setAddonBusyId] = useState("");
  const addonLock = useRef(false);
  const businessDate = data.context?.referenceBusinessDate || "";
  const canAct = (entry: ServiceEntry, action: ServiceAction) => canActAt(entry, action, now);
  const mine = useMemo(() => data.orders.filter((o) => o.nominees.some((n) => n.staffId === user.staffMemberId) || o.addons.some((a) => a.staffId === user.staffMemberId)), [data.orders, user.staffMemberId]);
  const unitsLoading = unitsSource !== mine || loadedRevision !== revision;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(mine.filter((o) => (o.flowVersion || 1) >= 2).map(async (o) => [o.id, await workbenchApi.units(o.id, controller.signal)] as const))
      .then((pairs) => { if (!controller.signal.aborted) { setUnits(Object.fromEntries(pairs)); setUnitsError(""); setUnitsSource(mine); setLoadedRevision(revision); } })
      .catch((e: unknown) => { if (!controller.signal.aborted) { setUnits({}); setUnitsError(errorText(e)); setUnitsSource(mine); setLoadedRevision(revision); } });
    return () => controller.abort();
  }, [mine, revision]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  const entries: ServiceEntry[] = mine.flatMap((order) => order.nominees.filter((n) => n.staffId === user.staffMemberId).map((nominee) => {
    const unit = units[order.id]?.find((u) => u.kind === "nominee" && u.nomineeId === nominee.id && u.staffId === user.staffMemberId) || null;
    const status = resolveServiceStatus(order, nominee, unit);
    return { order, nominee, unit, status };
  })).filter((entry) => !entry.unit || !data.context?.businessPeriodId ||
    (entry.unit.fulfillmentPeriodId || entry.order.businessPeriodId) === data.context.businessPeriodId)
    .sort((a, b) => Date.parse(startTime(a)) - Date.parse(startTime(b)));
  const requests = entries.filter((entry) => entry.status === "waiting" && entry.order.storeConfirmationStatus !== "pending");
  const waitingStore = entries.filter((entry) => entry.order.storeConfirmationStatus === "pending");
  const active = entries.filter((entry) => entry.status === "in_service");
  const current = active[0];
  const next = entries.find((entry) => ["accepted", "confirmed"].includes(entry.status));
  const sessionIds = new Set(mine.map((o) => o.sessionId));
  const guests = data.sessions.filter((s) => sessionIds.has(s.id));
  const selected = guests.find((s) => s.id === selectedSessionId) || guests.find((s) => s.id === current?.order.sessionId) || guests[0];
  const guestEntries = selected ? entries.filter((entry) => entry.order.sessionId === selected.id) : [];
  const selectedEntry = guestEntries.find((e) => e.status === "in_service") || guestEntries.find((e) => ["accepted", "confirmed"].includes(e.status)) || guestEntries[0];
  const guestOrders = selected ? mine.filter((o) => o.sessionId === selected.id) : [];
  const departed = selected?.entryStatus === "departed" || selected?.status === "readonly";
  const canOrder = Boolean(selected && selected.status === "active" && !departed &&
    (!data.context?.businessPeriodId || selected.businessPeriodId === data.context.businessPeriodId));
  const unavailable = loading || Boolean(loadError) || unitsLoading || Boolean(unitsError);
  const emptyMessage = (pending: string, empty: string) => {
    if (loadError) return "營業資料讀取失敗，請查看上方錯誤。";
    if (unitsError) return "服務進度讀取失敗，請重新整理。";
    return loading || unitsLoading ? pending : empty;
  };
  const disabled = unavailable || !user.staffMemberId || dialogBusy || Boolean(addonBusyId);
  const refresh = async () => { await onChanged(); setRevision((r) => r + 1); };
  const saved = async () => { await refresh(); setDialog(null); setDirty(false); setConfirmClose(false); setFeedback("操作已完成，工作台資料已重新整理。"); };
  const onBusy = useCallback((value: boolean) => { dialogBusyRef.current = value; setDialogBusy(value); }, []);
  const onDirty = useCallback((value: boolean) => setDirty(value), []);
  const closeDialog = () => {
    if (dialogBusyRef.current) return;
    if (dirty) { setConfirmClose(true); return; }
    setDialog(null); setConfirmClose(false);
  };
  const openService = (entry: ServiceEntry, action: ServiceAction) => {
    if (disabled || !canAct(entry, action)) return;
    setDirty(false); setConfirmClose(false); setDialog({ kind: "service", entry, action });
  };
  const selectGuest = (id: string) => {
    setSelectedSessionId(id);
    document.getElementById("designated-guest-desk")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
  };
  const openGuestAction = (kind: "meals" | "rooms" | "renew" | "delivery" | "pass" | "departure") => {
    if (!selected || disabled) return;
    setDirty(false); setConfirmClose(false);
    if (kind === "meals" || kind === "rooms" || kind === "renew") setDialog({ kind: "composer", session: selected, mode: kind });
    else if (kind === "delivery") setDialog({ kind, session: selected, orderId: selectedEntry?.order.id || guestOrders[0]?.id || "" });
    else setDialog({ kind, session: selected });
  };
  const pendingAddons = mine.flatMap((order) => order.addons.filter((a) => a.staffId === user.staffMemberId && a.status === "waiting" && order.storeConfirmationStatus !== "pending").map((addon) => ({ order, addon, unit: units[order.id]?.find((u) => u.kind === "addon" && u.staffId === user.staffMemberId) })));
  const activeAddons: ServiceEntry[] = mine.flatMap((order) => order.addons.filter((a) => a.staffId === user.staffMemberId && a.status !== "waiting").flatMap((addon) => {
    const parent = entries.find((e) => e.nominee.id === addon.parentNomineeId);
    const unit = units[order.id]?.find((u) => u.kind === "addon" && u.staffId === user.staffMemberId && !["completed", "cancelled"].includes(u.status));
    return parent && unit ? [{ order, nominee: { ...parent.nominee, serviceName: addon.serviceName }, unit, status: unit.status }] : [];
  }));
  const confirmAddon = async (order: OperationsOrder, unit: WorkbenchUnit | undefined) => {
    if (addonLock.current || disabled || (order.flowVersion || 1) >= 2 && !unit?.allowedActions.includes("accept")) return;
    addonLock.current = true; setAddonBusyId(order.id); setFeedback("");
    try {
      if (unit) await adminRequest(`${fulfillmentPath(order.id, unit.id)}/transition`, { method: "POST", body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: unit.version, action: "accept", quantity: 1, restMinutes: -1, compensationAmount: 0 }) });
      else await adminApi.confirmAddon(order.id);
      await refresh(); setFeedback("加購服務已確認。");
    } catch (e) { setFeedback(errorText(e)); await refresh(); }
    finally { addonLock.current = false; setAddonBusyId(""); }
  };
  let dialogTitle = "";
  if (dialog?.kind === "service") dialogTitle = serviceActionLabels[dialog.action];
  else if (dialog?.kind === "composer") dialogTitle = composerTitles[dialog.mode];
  else if (dialog?.kind === "addon") dialogTitle = "代客加購服務";
  else if (dialog?.kind === "delivery") dialogTitle = "建立委託與領取碼";
  else if (dialog?.kind === "pass") dialogTitle = "重發點餐碼";
  else if (dialog?.kind === "departure") dialogTitle = dialog.session.entryStatus === "departed" || dialog.session.status === "readonly" ? "重新開放點餐" : "顧客離店";
  return <div className="adminDesignatedWorkbench">
    <WorkbenchShiftBar businessDate={businessDate} staffId={user.staffMemberId} name={user.displayName} periodStatus={data.context?.periodStatus || ""} disabled={loading || Boolean(loadError) || dialogBusy} onChanged={refresh} />
    {!user.staffMemberId && <p className="dwNotice">此帳號尚未綁定店員，無法讀取個人指名及操作。請使用已綁定的指名人員帳號。</p>}
    {unitsError && <p className="adminFormError" role="alert">服務進度尚未更新：{unitsError} 請重新整理後再操作。</p>}
    {feedback && <p className="dwNotice" role="status">{feedback}</p>}
    <div className="dwTaskGrid">
      <AdminPanel title="等待我確認" description="直接指名與經理承接請求，在這裡回覆。" actions={<span className="dwCount">{unavailable ? "—" : requests.length + pendingAddons.length}</span>}>
        <div className="dwList">
          {requests.map((entry) => <article className="dwRequest" key={entry.nominee.id}>
            <div className="dwRow"><button className="dwName" type="button" onClick={() => selectGuest(entry.order.sessionId)}>{entry.order.customerName}</button><span className={`dwBadge${entry.order.requestSource === "manager_transfer" ? " is-manager" : ""}`}>{entry.order.requestSource === "manager_transfer" ? "經理承接請求" : "直接指名"}</span></div>
            <p className="dwRequestTime">{formatClock(startTime(entry))}–{formatClock(endTime(entry))}<span>{entry.nominee.serviceName}</span></p>
            <p className="dwHint">{entry.order.gameId} · {entry.order.customerLocation || "未註記位置"}{entry.order.customerNote ? ` · ${entry.order.customerNote}` : ""}</p>
            <div className="dwActions"><AdminButton disabled={disabled || !canAct(entry, "accept")} onClick={() => openService(entry, "accept")}>確認承接</AdminButton><AdminButton variant="ghost" disabled={disabled || !canAct(entry, "decline")} onClick={() => openService(entry, "decline")}>無法承接</AdminButton></div>
          </article>)}
          {pendingAddons.map(({ order, addon, unit }) => <article className="dwRequest" key={addon.id}><div className="dwRow"><strong>{order.customerName}</strong><span className="dwBadge">加購確認</span></div><p>{addon.serviceName}</p><AdminButton disabled={disabled || Boolean(unit && !unit.allowedActions.includes("accept"))} onClick={() => void confirmAddon(order, unit)}>確認加購</AdminButton></article>)}
          {activeAddons.map((entry) => <article className="dwRequest" key={entry.unit?.id}><div className="dwRow"><strong>{entry.order.customerName} · 加購服務</strong>{badge(entry.status)}</div><p>{entry.nominee.serviceName}</p><div className="dwActions">{canAct(entry, "start") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "start")}>開始加購</AdminButton>}{canAct(entry, "complete") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "complete")}>完成加購</AdminButton>}{canAct(entry, "cancel") && <AdminButton variant="ghost" disabled={disabled} onClick={() => openService(entry, "cancel")}>取消未服務加購</AdminButton>}</div></article>)}
          {!requests.length && !pendingAddons.length && !activeAddons.length && <p className="dwEmpty">{emptyMessage("讀取待辦中…", "目前沒有待處理的指名或加購。")}</p>}
          {waitingStore.length > 0 && <p className="dwHint">另有 {waitingStore.length} 筆等待店家承接，承接後才會開放指名確認。</p>}
        </div>
      </AdminPanel>
      <div className="dwStack">
        <AdminPanel title="目前服務" description="掌握實際進度，直接處理完成或加購。">
          {current ? <div className="dwCurrent">
            <div className="dwRow"><button type="button" className="dwName" onClick={() => selectGuest(current.order.sessionId)}>{current.order.customerName}</button>{badge(current.status)}</div>
            <p>{current.nominee.serviceName} · {formatClock(startTime(current))}–{formatClock(endTime(current))}</p>
            <div className="dwRemaining"><strong>{Math.max(0, Math.ceil((Date.parse(endTime(current)) - now) / 60_000))}</strong><span>分鐘剩餘<small>休息 {current.unit?.restMinutesReserved ?? current.nominee.bufferMinutes ?? 0} 分鐘</small></span></div>
            {current.unit?.originalScheduledStartsAt && <p className="dwHint">原預約 {formatClock(current.unit.originalScheduledStartsAt)}–{formatClock(current.unit.originalScheduledEndsAt)}</p>}
            <div className="dwActions"><AdminButton disabled={disabled || !canAct(current, "complete")} onClick={() => openService(current, "complete")}>完成服務</AdminButton><AdminButton variant="secondary" disabled={disabled || !["open", undefined].includes(data.sessions.find((s) => s.id === current.order.sessionId)?.entryStatus)} onClick={() => { setDirty(false); setDialog({ kind: "addon", entry: current }); }}>加購服務</AdminButton></div>
            {active.length > 1 && <p className="adminFormError" role="alert">另有 {active.length - 1} 筆服務進行中，請在今日排程核對進度。</p>}
          </div> : next ? <div className="dwCurrent"><div className="dwRow"><strong>{next.order.customerName}</strong>{badge(next.status)}</div><p>{formatClock(startTime(next))}–{formatClock(endTime(next))} · {next.nominee.serviceName}</p><AdminButton disabled={disabled || !canAct(next, "start_now")} onClick={() => openService(next, "start_now")}>開始服務</AdminButton></div> : <p className="dwEmpty">{emptyMessage("讀取服務進度中…", "目前沒有進行中或已承接的服務。")}</p>}
        </AdminPanel>
        <section className="dwNext"><span>下一位</span>{next ? <><strong>{next.order.customerName}</strong><small>{formatClock(startTime(next))} · {next.nominee.serviceName}</small><AdminButton variant="ghost" onClick={() => selectGuest(next.order.sessionId)}>查看顧客</AdminButton></> : <p>{emptyMessage("讀取下一位顧客中…", "目前沒有已承接的下一位顧客。")}</p>}</section>
      </div>
    </div>
    <div className="dwTaskGrid">
      <AdminPanel className="dwGuestDesk" title="顧客現場處理" description="只顯示這次營業中與我有關的顧客及訂單。">
        <div id="designated-guest-desk" className="dwGuestTabs" role="group" aria-label="選擇營業中顧客">{guests.map((guest) => <button type="button" key={guest.id} className={guest.id === selected?.id ? "isSelected" : ""} aria-pressed={guest.id === selected?.id} onClick={() => setSelectedSessionId(guest.id)}>{guest.customerName}{guest.entryStatus === "departed" ? " · 已離店" : ""}</button>)}</div>
        {selected ? <>
          <div className="dwGuestIdentity"><h3>{selected.customerName}</h3><p>ID {selected.gameId} · {guestOrders.find((o) => o.customerLocation)?.customerLocation || "未註記位置"}</p></div>
          <div className="dwGuestActions">
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("meals")}>代點餐點</AdminButton>
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("rooms")}>包廂需求</AdminButton>
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("pass")}>重發點餐碼</AdminButton>
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("renew")}>建立續時</AdminButton>
            <AdminButton variant="secondary" disabled={disabled} onClick={() => openGuestAction("delivery")}>委託／領取碼</AdminButton>
            <AdminButton variant="ghost" disabled={disabled || !departed && guestEntries.some((e) => e.status === "in_service")} onClick={() => openGuestAction("departure")}>{departed ? "重新開放點餐" : "顧客離店"}</AdminButton>
          </div>
          <div className="dwList dwGuestOrders">{guestOrders.map((order) => <article className="dwGuestOrder" key={order.id}><div className="dwRow"><strong>{order.orderNumber}</strong><span className="dwHint">{orderStatusLabel(order.status)}</span></div><p>{order.items?.filter((item) => item.kind !== "tip").map((item) => `${item.name} × ${item.quantity}`).join("、") || order.nominees.map((n) => n.serviceName).join("、")}</p>{order.roomBookings.map((room, index) => <p className="dwHint" key={`${room.roomName}-${index}`}>{room.roomName} · {formatClock(room.startsAt)}–{formatClock(room.endsAt)}</p>)}{order.customerNote && <p className="dwHint">備註：{order.customerNote}</p>}</article>)}</div>
        </> : <p className="dwEmpty">{emptyMessage("讀取今日顧客中…", "尚無與我有關的營業中顧客。")}</p>}
      </AdminPanel>
      <AdminPanel title="我的今日排程" description="依服務開始時間排序；點選顧客可在左側處理。">
        <div className="dwSchedule">{entries.map((entry) => <article className={`dwScheduleItem${entry.status === "in_service" ? " isCurrent" : ""}`} key={entry.nominee.id}>
          <div className="dwScheduleTime"><strong>{formatClock(startTime(entry))}</strong><small>{formatClock(endTime(entry))}</small></div>
          <div className="dwScheduleCopy"><div className="dwRow"><button type="button" className="dwName" onClick={() => selectGuest(entry.order.sessionId)}>{entry.order.customerName}</button>{badge(entry.status)}</div><p>{entry.nominee.serviceName}{entry.unit?.purchasedMinutes ? ` · ${entry.unit.purchasedMinutes} 分鐘` : ""}</p>
            <div className="dwActions">{canAct(entry, "start_now") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "start_now")}>開始服務</AdminButton>}{canAct(entry, "complete") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "complete")}>完成服務</AdminButton>}</div>
            {["cancel", "reschedule", "backfill", "carry_forward", "shorten"].some((a) => canAct(entry, a as ServiceAction)) && <details className="dwExceptions"><AdminDisclosureSummary>其他處理</AdminDisclosureSummary><div className="dwActions">{(["reschedule", "shorten", "cancel", "backfill", "carry_forward"] as const).filter((a) => canAct(entry, a)).map((action) => <AdminButton variant="ghost" key={action} disabled={disabled} onClick={() => openService(entry, action)}>{serviceActionLabels[action]}</AdminButton>)}</div></details>}
            {entry.status === "needs_coordination" && <p className="dwHint">已交回經理，等待重新協調。</p>}
            {!entry.unit && (entry.order.flowVersion || 1) < 2 && !legacyStandalone(entry.order) && entry.status === "confirmed" && <p className="dwHint">舊版混合訂單需由經理核對整單服務進度。</p>}
          </div>
        </article>)}{!entries.length && <p className="dwEmpty">{emptyMessage("讀取排程中…", "今日尚無指名排程。")}</p>}</div>
      </AdminPanel>
    </div>
    <AdminDialog open={Boolean(dialog)} title={dialogTitle} description="完成操作後留在指名人員工作台。" className="adminDesignatedWorkbenchDialog" onClose={closeDialog} actions={null}>
      {dialog?.kind === "service" && <WorkbenchServiceDialog entry={dialog.entry} action={dialog.action} onSaved={saved} onBusy={onBusy} />}
      {dialog?.kind === "addon" && <WorkbenchAddonForm entry={dialog.entry} onSaved={saved} onBusy={onBusy} />}
      {dialog?.kind === "composer" && <WorkbenchOrderComposer sessionId={dialog.session.id} businessDate={businessDate} mode={dialog.mode} staffId={user.staffMemberId} onSaved={saved} onBusy={onBusy} />}
      {dialog?.kind === "delivery" && <WorkbenchDeliveryAction session={dialog.session} orderId={dialog.orderId} businessDate={businessDate} user={user} onBusy={onBusy} onDirty={onDirty} />}
      {dialog?.kind === "pass" && <WorkbenchPassAction session={dialog.session} onChanged={refresh} onBusy={onBusy} />}
      {dialog?.kind === "departure" && <WorkbenchDepartureAction session={dialog.session} onSaved={saved} onBusy={onBusy} />}
      {confirmClose && <div className="dwNotice" role="alert"><p>委託資料尚未建立，確定放棄這次填寫？</p><div className="dwActions"><AdminButton variant="ghost" disabled={dialogBusy} onClick={() => setConfirmClose(false)}>繼續填寫</AdminButton><AdminButton variant="secondary" disabled={dialogBusy} onClick={() => { setDialog(null); setDirty(false); setConfirmClose(false); }}>放棄並關閉</AdminButton></div></div>}
    </AdminDialog>
  </div>;
}
