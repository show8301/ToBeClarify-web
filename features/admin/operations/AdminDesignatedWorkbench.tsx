"use client";

import { OrderServiceActions } from "@/features/admin/shared/OrderServiceActions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, adminRequest } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { canAct as canActAt, legacyStandalone, resolveServiceStatus } from "./workbenchRules";
import { WorkbenchShiftBar } from "./WorkbenchShiftBar";
import { WorkbenchOrderComposer } from "./WorkbenchOrderComposer";
import { WorkbenchAddonForm } from "./WorkbenchAddonForm";
import { WorkbenchDeliveryAction, WorkbenchDepartureAction, WorkbenchPassAction } from "./WorkbenchGuestActions";
import { WorkbenchServiceDialog, serviceActionLabel, serviceActionLabels } from "./WorkbenchServiceDialog";
import { WorkbenchItemCompletionDialog } from "./WorkbenchItemCompletionDialog";
import { WorkbenchOrderReceiptForm } from "./WorkbenchOrderReceiptDialog";
import type { GuestOrderDialog } from "./WorkbenchGuestOrders";
import { WorkbenchGuestOrders } from "./WorkbenchGuestOrders";
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
  | { kind: "pass" | "departure"; session: OperationsSession }
  | GuestOrderDialog;

const composerTitles: Record<ComposerMode, string> = { meals: "代點餐點", rooms: "代客訂購包廂", renew: "建立續時指名", transfer: "經理建立承接請求" };
const startTime = (entry: ServiceEntry) => entry.unit?.scheduledStartsAt || entry.nominee.requestedStartsAt;
const endTime = (entry: ServiceEntry) => entry.unit?.scheduledEndsAt || entry.nominee.requestedServiceEndsAt;
const noGuestOrders: OperationsOrder[] = [];
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
  const [guestOpen, setGuestOpen] = useState(false);
  const [actionVisible, setActionVisible] = useState(true);
  const [pendingResult, setPendingResult] = useState(false);
  const pendingResultRef = useRef(false);
  const viewHeading = useRef<HTMLSpanElement | null>(null);
  const rootTrigger = useRef<HTMLElement | null>(null);
  const queuedNavigation = useRef<(() => void) | null>(null);
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
  const entries: ServiceEntry[] = mine.flatMap((order) => order.nominees.map((nominee) => {
    const unit = units[order.id]?.find((u) => u.kind === "nominee" && u.nomineeId === nominee.id) || null;
    const status = resolveServiceStatus(order, nominee, unit);
    return { order, nominee, unit, status };
  })).filter((entry) => !entry.unit || !data.context?.businessPeriodId ||
    (entry.unit.fulfillmentPeriodId || entry.order.businessPeriodId) === data.context.businessPeriodId)
    .sort((a, b) => Date.parse(startTime(a)) - Date.parse(startTime(b)));
  const ownEntries = entries.filter(entry => entry.nominee.staffId === user.staffMemberId);
  const requests = entries.filter((entry, index, all) => entry.status === "waiting" && entry.order.storeConfirmationStatus !== "pending" && all.findIndex(e => e.order.id === entry.order.id && e.status === "waiting") === index);
  const waitingStore = entries.filter((entry) => entry.order.storeConfirmationStatus === "pending");
  const active = ownEntries.filter((entry) => entry.status === "in_service");
  const current = active[0];
  const next = ownEntries.find((entry) => ["accepted", "confirmed"].includes(entry.status));
  const sessionIds = new Set(mine.map((o) => o.sessionId));
  const guests = data.sessions.filter((s) => sessionIds.has(s.id));
  const selected = guests.find((s) => s.id === selectedSessionId) || guests.find((s) => s.id === current?.order.sessionId) || guests[0];
  const guestEntries = selected ? entries.filter((entry) => entry.order.sessionId === selected.id) : [];
  const selectedEntry = guestEntries.find((e) => e.status === "in_service") || guestEntries.find((e) => ["accepted", "confirmed"].includes(e.status)) || guestEntries[0];
  const ordersBySession = useMemo(() => {
    const grouped: Record<string, OperationsOrder[]> = {};
    for (const order of mine) (grouped[order.sessionId] ??= []).push(order);
    return grouped;
  }, [mine]);
  const guestOrders = selected ? ordersBySession[selected.id] || noGuestOrders : noGuestOrders;
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
  const saved = async (message = "操作已完成，工作台資料已重新整理。") => {
    await refresh(); setDialog(null); setDirty(false); setConfirmClose(false); setFeedback(message);
  };
  const onBusy = useCallback((value: boolean) => { dialogBusyRef.current = value; setDialogBusy(value); }, []);
  const onPending = useCallback((value: boolean) => { pendingResultRef.current = value; setPendingResult(value); }, []);
  const onDirty = useCallback((value: boolean) => setDirty(value), [setDirty]);
  const dismiss = () => {
    setGuestOpen(false); setDialog(null); setDirty(false); setConfirmClose(false); queuedNavigation.current = null;
  };
  const navigate = (action: () => void) => {
    if (dialogBusyRef.current || pendingResultRef.current) return;
    if (dirty) { queuedNavigation.current = action; setConfirmClose(true); return; }
    action();
  };
  const closeDialog = () => navigate(dismiss);
  const captureTrigger = () => {
    if (!guestOpen && !dialog) rootTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const openAction = (target: DialogTarget) => {
    captureTrigger();
    navigate(() => { setDirty(false); setConfirmClose(false); setDialog(target); setActionVisible(true); });
  };
  const openService = (entry: ServiceEntry, action: ServiceAction) => {
    if (disabled || !canAct(entry, action)) return;
    openAction({ kind: "service", entry, action });
  };
  const selectGuest = (id: string) => {
    captureTrigger();
    navigate(() => { setSelectedSessionId(id); setDialog(null); setDirty(false); setGuestOpen(true); setActionVisible(false); });
  };
  const returnToGuest = () => {
    if (dialogBusyRef.current || pendingResultRef.current) return;
    // Keep the mounted form and its quote/retry state when returning to this customer's overview.
    setGuestOpen(true); setActionVisible(false); setConfirmClose(false);
  };
  const openGuestAction = (kind: "meals" | "rooms" | "renew" | "delivery" | "pass" | "departure") => {
    if (!selected || disabled) return;
    if (kind === "meals" || kind === "rooms" || kind === "renew") openAction({ kind: "composer", session: selected, mode: kind });
    else if (kind === "delivery") openAction({ kind, session: selected, orderId: selectedEntry?.order.id || guestOrders[0]?.id || "" });
    else openAction({ kind, session: selected });
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
  if (dialog?.kind === "service") dialogTitle = serviceActionLabel(dialog.action, dialog.entry.unit?.kind);
  else if (dialog?.kind === "composer") dialogTitle = composerTitles[dialog.mode];
  else if (dialog?.kind === "addon") dialogTitle = "代客加購服務";
  else if (dialog?.kind === "delivery") dialogTitle = "建立委託與領取碼";
  else if (dialog?.kind === "pass") dialogTitle = "重發點餐碼";
  else if (dialog?.kind === "departure") dialogTitle = dialog.session.entryStatus === "departed" || dialog.session.status === "readonly" ? "重新開放點餐" : "顧客離店";
  else if (dialog?.kind === "complete") dialogTitle = dialog.unit.kind === "meal" ? "確認已送達" : "確認使用完成";
  else if (dialog?.kind === "receipt") dialogTitle = "同單收款";
  const targetOrder = dialog && "entry" in dialog ? dialog.entry.order : dialog && "order" in dialog ? dialog.order : null;
  const targetSession = dialog && "session" in dialog ? dialog.session : targetOrder ? data.sessions.find(s => s.id === targetOrder.sessionId) : selected;
  const identity = actionVisible && dialog ? {
    name: targetSession?.customerName || targetOrder?.customerName || "顧客",
    gameId: targetSession?.gameId || targetOrder?.gameId || "",
    location: targetOrder?.customerLocation || (targetSession ? ordersBySession[targetSession.id]?.find(o => o.customerLocation)?.customerLocation : "") || "未註記位置",
  } : { name: selected?.customerName || "顧客", gameId: selected?.gameId || "", location: guestOrders.find(o => o.customerLocation)?.customerLocation || "未註記位置" };
  const dialogBlocked = dialogBusy || pendingResult;
  const surfaceOpen = guestOpen || Boolean(dialog);
  useEffect(() => { if (surfaceOpen) viewHeading.current?.focus(); }, [surfaceOpen, actionVisible, dialogTitle]);
  return <div className="adminDesignatedWorkbench">
    <WorkbenchShiftBar businessDate={businessDate} staffId={user.staffMemberId} name={user.displayName} periodStatus={data.context?.periodStatus || ""} disabled={loading || Boolean(loadError) || dialogBusy} onChanged={refresh} />
    {!user.staffMemberId && <p className="dwNotice">此帳號尚未綁定店員，無法讀取個人指名及操作。請使用已綁定的指名人員帳號。</p>}
    {unitsError && <p className="adminFormError" role="alert">服務進度尚未更新：{unitsError} 請重新整理後再操作。</p>}
    {feedback && <p className="dwNotice" role="status">{feedback}</p>}
    <div className="dwTaskGrid">
      <div className="dwStack dwCurrentColumn">
        <AdminPanel title="目前服務" description="掌握實際進度，直接處理完成或加購。">
          {current ? <div className="dwCurrent">
            <div className="dwRow"><button type="button" className="dwName" onClick={() => selectGuest(current.order.sessionId)}>{current.order.customerName}</button>{badge(current.status)}</div>
            <p>{current.nominee.serviceName} · {formatClock(startTime(current))}–{formatClock(endTime(current))}</p>
            <div className="dwRemaining"><strong>{Math.max(0, Math.ceil((Date.parse(endTime(current)) - now) / 60_000))}</strong><span>分鐘剩餘<small>休息 {current.unit?.restMinutesReserved ?? current.nominee.bufferMinutes ?? 0} 分鐘</small></span></div>
            {current.unit?.originalScheduledStartsAt && <p className="dwHint">原預約 {formatClock(current.unit.originalScheduledStartsAt)}–{formatClock(current.unit.originalScheduledEndsAt)}</p>}
            <div className="dwActions"><AdminButton disabled={disabled || !canAct(current, "complete")} onClick={() => openService(current, "complete")}>完成此指名</AdminButton><AdminButton variant="secondary" disabled={disabled || !["open", undefined].includes(data.sessions.find((s) => s.id === current.order.sessionId)?.entryStatus)} onClick={() => openAction({ kind: "addon", entry: current })}>加購服務</AdminButton><AdminButton variant="ghost" onClick={() => selectGuest(current.order.sessionId)}>顧客處理</AdminButton></div>
            <OrderServiceActions presentation="workbench" primaryAction="none" orderId={current.order.id} refreshKey={String(current.unit?.version || 0)} disabled={disabled} onChanged={refresh} onBusy={onBusy} />
            {active.length > 1 && <p className="adminFormError" role="alert">另有 {active.length - 1} 筆服務進行中，請在今日排程核對進度。</p>}
          </div> : next ? <div className="dwCurrent"><div className="dwRow"><strong>{next.order.customerName}</strong>{badge(next.status)}</div><p>{formatClock(startTime(next))}–{formatClock(endTime(next))} · {next.nominee.serviceName}</p><OrderServiceActions presentation="workbench" primaryAction="start_now" orderId={next.order.id} refreshKey={String(next.unit?.version || 0)} disabled={disabled} onChanged={refresh} onBusy={onBusy} /></div> : <p className="dwEmpty">{emptyMessage("讀取服務進度中…", "目前沒有進行中或已承接的服務。")}</p>}
        </AdminPanel>
        <section className="dwNext"><span>下一位</span>{next ? <><strong>{next.order.customerName}</strong><small>{formatClock(startTime(next))} · {next.nominee.serviceName}</small><AdminButton variant="ghost" onClick={() => selectGuest(next.order.sessionId)}>查看顧客</AdminButton></> : <p>{emptyMessage("讀取下一位顧客中…", "目前沒有已承接的下一位顧客。")}</p>}</section>
      </div>
      <AdminPanel className="dwRequestsPanel" title="待處理指名與加購" description="本單任一名指名人員可依現場協調代辦整單。" actions={<span className="dwCount">{unavailable ? "—" : requests.length + pendingAddons.length}</span>}>
        <div className="dwList">
          {requests.map((entry) => <article className="dwRequest" key={entry.nominee.id}>
            <div className="dwRow"><button className="dwName" type="button" onClick={() => selectGuest(entry.order.sessionId)}>{entry.order.customerName}</button><span className={`dwBadge${entry.order.requestSource === "manager_transfer" ? " is-manager" : ""}`}>{entry.order.requestSource === "manager_transfer" ? "經理承接請求" : "直接指名"}</span></div>
            <p className="dwRequestTime">{formatClock(startTime(entry))}–{formatClock(endTime(entry))}<span>{entry.nominee.serviceName}</span></p>
            <p className="dwHint">{entry.order.gameId} · {entry.order.customerLocation || "未註記位置"}{entry.order.customerNote ? ` · ${entry.order.customerNote}` : ""}</p>
            <p className="dwHint">同單內容：{entry.order.items?.filter((item) => ["menu_item", "menu_set", "room_service"].includes(item.kind)).map((item) => `${item.name} × ${item.quantity}`).join("、") || "無其他餐點或包廂"}</p>
            <div className="dwActions"><OrderServiceActions presentation="workbench" orderId={entry.order.id} refreshKey={String(entry.unit?.version || 0)} disabled={disabled} onChanged={refresh} onBusy={onBusy} /><AdminButton variant="ghost" disabled={disabled || !canAct(entry, "decline")} onClick={() => openService(entry, "decline")}>無法承接</AdminButton><AdminButton variant="ghost" onClick={() => selectGuest(entry.order.sessionId)}>顧客處理</AdminButton></div>
          </article>)}
          {pendingAddons.map(({ order, addon, unit }) => <article className="dwRequest" key={addon.id}><div className="dwRow"><strong>{order.customerName}</strong><span className="dwBadge">加購確認</span></div><p>{addon.serviceName}</p><AdminButton disabled={disabled || Boolean(unit && !unit.allowedActions.includes("accept"))} onClick={() => void confirmAddon(order, unit)}>確認加購</AdminButton></article>)}
          {activeAddons.map((entry) => <article className="dwRequest" key={entry.unit?.id}><div className="dwRow"><strong>{entry.order.customerName} · 加購服務</strong>{badge(entry.status)}</div><p>{entry.nominee.serviceName}</p><div className="dwActions">{canAct(entry, "start") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "start")}>開始加購</AdminButton>}{canAct(entry, "complete") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "complete")}>完成加購</AdminButton>}{canAct(entry, "cancel") && <AdminButton variant="ghost" disabled={disabled} onClick={() => openService(entry, "cancel")}>取消未服務加購</AdminButton>}</div></article>)}
          {!requests.length && !pendingAddons.length && !activeAddons.length && <p className="dwEmpty">{emptyMessage("讀取待辦中…", "目前沒有待處理的指名或加購。")}</p>}
          {waitingStore.length > 0 && <p className="dwHint">另有 {waitingStore.length} 筆等待店家承接，承接後才會開放指名確認。</p>}
        </div>
      </AdminPanel>
    </div>
    <div className="dwTaskGrid">
      <AdminPanel className="dwGuestDesk" title="顧客現場處理" description="選擇顧客，直接開啟處理視窗。">
        <div className="dwGuestTabs" role="group" aria-label="開啟顧客處理">{guests.map(guest => <button type="button" key={guest.id} onClick={() => selectGuest(guest.id)}>{guest.customerName}{guest.entryStatus === "departed" ? " · 已離店" : ""}</button>)}</div>
        {!guests.length && <p className="dwEmpty">{emptyMessage("讀取今日顧客中…", "尚無與我有關的營業中顧客。")}</p>}
      </AdminPanel>
      <AdminPanel title="我的今日排程" description="依服務開始時間排序；點選顧客開啟處理視窗。">
        <div className="dwSchedule">{ownEntries.map((entry) => <article className={`dwScheduleItem${entry.status === "in_service" ? " isCurrent" : ""}`} key={entry.nominee.id}>
          <div className="dwScheduleTime"><strong>{formatClock(startTime(entry))}</strong><small>{formatClock(endTime(entry))}</small></div>
          <div className="dwScheduleCopy"><div className="dwRow"><button type="button" className="dwName" onClick={() => selectGuest(entry.order.sessionId)}>{entry.order.customerName}</button>{badge(entry.status)}</div><p>{entry.nominee.serviceName}{entry.unit?.purchasedMinutes ? ` · ${entry.unit.purchasedMinutes} 分鐘` : ""}</p>
            <div className="dwActions"><AdminButton variant="ghost" onClick={() => selectGuest(entry.order.sessionId)}>顧客處理</AdminButton>{canAct(entry, "start_now") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "start_now")}>開始此指名</AdminButton>}{canAct(entry, "complete") && <AdminButton variant="secondary" disabled={disabled} onClick={() => openService(entry, "complete")}>完成此指名</AdminButton>}</div>
            {["cancel", "reschedule", "backfill", "carry_forward", "shorten"].some((a) => canAct(entry, a as ServiceAction)) && <details className="dwExceptions"><AdminDisclosureSummary>此項服務的其他處理</AdminDisclosureSummary><div className="dwActions">{(["reschedule", "shorten", "cancel", "backfill", "carry_forward"] as const).filter((a) => canAct(entry, a)).map((action) => <AdminButton variant="ghost" key={action} disabled={disabled} onClick={() => openService(entry, action)}>{serviceActionLabels[action]}</AdminButton>)}</div></details>}
            {entry.status === "needs_coordination" && <p className="dwHint">已交回經理，等待重新協調。</p>}
            {!entry.unit && (entry.order.flowVersion || 1) < 2 && !legacyStandalone(entry.order) && entry.status === "confirmed" && <p className="dwHint">舊版混合訂單需由經理核對整單服務進度。</p>}
          </div>
        </article>)}{!entries.length && <p className="dwEmpty">{emptyMessage("讀取排程中…", "今日尚無指名排程。")}</p>}</div>
      </AdminPanel>
    </div>
    <AdminDialog open={surfaceOpen} title={<span ref={viewHeading} tabIndex={-1}>{identity.name}｜{dialog && actionVisible ? dialogTitle : "顧客處理"}</span>} description={`${identity.gameId} · ${identity.location}`} className="adminDesignatedWorkbenchDialog dwCustomerDialog" closeLabel="關閉顧客處理視窗" closeDisabled={dialogBlocked} finalFocus={() => rootTrigger.current?.isConnected ? rootTrigger.current : document.querySelector<HTMLElement>(".dwGuestTabs button")} onClose={closeDialog} actions={confirmClose ? <div className="dwDiscardPrompt" role="alert"><p>有尚未儲存的內容，確定放棄並離開？</p><div className="dwActions"><AdminButton variant="ghost" disabled={dialogBlocked} onClick={() => { setConfirmClose(false); setActionVisible(true); queuedNavigation.current = null; }}>繼續編輯</AdminButton>{guestOpen && actionVisible && <AdminButton variant="secondary" disabled={dialogBlocked} onClick={returnToGuest}>保留並返回顧客處理</AdminButton>}<AdminButton variant="secondary" disabled={dialogBlocked} onClick={() => { const action = queuedNavigation.current; queuedNavigation.current = null; setDirty(false); setConfirmClose(false); action?.(); }}>放棄修改並離開</AdminButton></div></div> : null}>
      <div className="adminDesignatedWorkbench dwDialogContent">
        <div hidden={Boolean(dialog && actionVisible)}>
          {dialog && dirty && <div className="dwNotice" role="status">已保留「{dialogTitle}」未送出的內容。<AdminButton variant="secondary" onClick={() => setActionVisible(true)}>繼續編輯草稿</AdminButton></div>}
        {selected ? <>

          <div className="dwGuestActions">
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("meals")}>代點餐點</AdminButton>
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("rooms")}>包廂訂購</AdminButton>
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("pass")}>重發點餐碼</AdminButton>
            <AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => openGuestAction("renew")}>建立續時</AdminButton>
            <AdminButton variant="secondary" disabled={disabled} onClick={() => openGuestAction("delivery")}>委託／領取碼</AdminButton>
            <AdminButton variant="ghost" disabled={disabled || !departed && guestEntries.some((e) => e.status === "in_service")} onClick={() => openGuestAction("departure")}>{departed ? "重新開放點餐" : "顧客離店"}</AdminButton>
          </div>
          <WorkbenchGuestOrders key={selected.id} orders={guestOrders} units={units} unavailable={unavailable} disabled={disabled} cashPeriodId={data.context?.businessPeriodId || ""} businessDate={businessDate} staffId={user.staffMemberId} entries={[...entries, ...activeAddons]} canAct={canAct} onServiceAction={openService} onChanged={refresh} onBusy={onBusy} onOpenDetail={openAction} />
        </> : <p className="dwEmpty">{emptyMessage("讀取今日顧客中…", "尚無與我有關的營業中顧客。")}</p>}

        </div>
        <div hidden={!dialog || !actionVisible}>
          {dialog && guestOpen && <AdminButton variant="ghost" className="dwReturnToGuest" disabled={dialogBlocked} onClick={returnToGuest}>返回顧客處理</AdminButton>}
          {dialog?.kind === "service" && <WorkbenchServiceDialog key={`${dialog.entry.order.id}:${dialog.entry.nominee.id}:${dialog.action}`} entry={dialog.entry} action={dialog.action} orderUnits={units[dialog.entry.order.id]} onSaved={() => saved(`${dialog.entry.nominee.serviceName}：${dialog.action === "complete" ? "此服務已完成" : "服務操作已記錄"}。`)} onBusy={onBusy} onDirtyChange={onDirty} onPendingChange={onPending} />}
          {dialog?.kind === "addon" && <WorkbenchAddonForm key={dialog.entry.nominee.id} entry={dialog.entry} onSaved={saved} onBusy={onBusy} onDirtyChange={onDirty} />}
          {dialog?.kind === "composer" && <WorkbenchOrderComposer key={`${dialog.session.id}:${dialog.mode}`} sessionId={dialog.session.id} businessDate={businessDate} mode={dialog.mode} staffId={user.staffMemberId} initialLocation={ordersBySession[dialog.session.id]?.find(o => o.customerLocation)?.customerLocation || ""} onSaved={saved} onBusy={onBusy} onDirtyChange={onDirty} onPendingChange={onPending} />}
          {dialog?.kind === "delivery" && <WorkbenchDeliveryAction session={dialog.session} orderId={dialog.orderId} businessDate={businessDate} user={user} onBusy={onBusy} onDirty={onDirty} />}
          {dialog?.kind === "pass" && <WorkbenchPassAction session={dialog.session} onChanged={refresh} onBusy={onBusy} />}
          {dialog?.kind === "departure" && <WorkbenchDepartureAction session={dialog.session} onSaved={saved} onBusy={onBusy} onDirtyChange={onDirty} />}
          {dialog?.kind === "complete" && <WorkbenchItemCompletionDialog embedded key={dialog.unit.id} order={dialog.order} unit={dialog.unit} onClose={() => navigate(() => { setDialog(null); setDirty(false); })} onCommitted={message => { void saved(message); }} onBusy={onBusy} onDirtyChange={onDirty} onPendingChange={onPending} />}
          {dialog?.kind === "receipt" && <WorkbenchOrderReceiptForm key={dialog.order.id} order={dialog.order} account={dialog.account} cashPeriodId={data.context?.businessPeriodId || ""} businessDate={businessDate} onClose={() => navigate(() => { setDialog(null); setDirty(false); })} onCommitted={message => { void saved(message); }} onBusy={onBusy} onDirtyChange={onDirty} onPendingChange={onPending} />}
        </div>
      </div>
    </AdminDialog>
  </div>;
}
