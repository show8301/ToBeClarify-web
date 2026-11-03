"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { adminRequest } from "@/features/admin/api/client.js";
import { AdminButton, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { WorkbenchShiftBar } from "./WorkbenchShiftBar";
import { ServiceGuestPanel } from "./ServiceGuestPanel";
import type { ServiceGuestScope } from "./ServiceGuestPicker";
import { ServiceOrderDetail } from "./ServiceOrderDetail";
import { StandaloneRoomTask } from "./StandaloneRoomTask";
import { serviceTask } from "./serviceQueue";
import type { ServiceFilter } from "./serviceQueue";
import { list, parseUnits, record, textValue } from "./workbenchApi";
import type { WorkbenchUnit } from "./workbenchApi";
import type { CurrentAdminUser, OperationsAction, OperationsActionState, OperationsData, OperationsOrder } from "./operationsTypes";

export function AdminServiceDashboard({ data, user, navigate, actionState, onChanged, disabled, loading = false, loadError = "", pageActions, eyebrow = "服務員 DASHBOARD" }: {
  data: OperationsData; user?: CurrentAdminUser; navigate: (route: string) => void; runAction: OperationsAction;
  actionState: OperationsActionState; onChanged: () => Promise<void>; disabled: boolean; loading?: boolean; loadError?: string;
  pageActions?: ReactNode; eyebrow?: string;
}) {
  const date = data.context?.referenceBusinessDate || "";
  const periodId = data.context?.businessPeriodId || "";
  const [filter, setFilter] = useState<ServiceFilter>("unfinished");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<{ order: OperationsOrder; periodId: string } | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [workspace, setWorkspace] = useState<"tasks" | "guests">("tasks");
  const [guestScope, setGuestScope] = useState<ServiceGuestScope>({ entryScope: "all", periodScope: "all" });
  const workspaceId = useId();
  const scrollRequest = useRef<number | null>(null);
  useEffect(() => () => { if (scrollRequest.current !== null) cancelAnimationFrame(scrollRequest.current); }, []);
  const scrollTo = (selector: string) => {
    if (scrollRequest.current !== null) cancelAnimationFrame(scrollRequest.current);
    scrollRequest.current = requestAnimationFrame(() => document.querySelector(selector)?.scrollIntoView({ block: "start" }));
  };
  const key = `${date}:${data.refreshedAt}:${revision}`;
  const [fulfillment, setFulfillment] = useState<{ key: string; units: Record<string, WorkbenchUnit[]>; error: string } | null>(null);
  useEffect(() => {
    if (!date) return;
    const c = new AbortController();
    adminRequest(`/service-fulfillment?${new URLSearchParams({ businessDate: date })}`, { signal: c.signal })
      .then((value: unknown) => {
        const units = Object.fromEntries(list(value, (item) => { const row = record(item); return [textValue(row.orderId), parseUnits(row)] as const; }));
        if (!c.signal.aborted) setFulfillment({ key, units, error: "" });
      }).catch((e: unknown) => { if (!c.signal.aborted) setFulfillment({ key, units: {}, error: e instanceof Error ? e.message : "履約資料讀取失敗。" }); });
    return () => c.abort();
  }, [date, key]);
  const current = fulfillment?.key === key ? fulfillment : null;
  const units = current?.units || {};
  const standaloneRooms = data.roomOrders.filter((r) => !r.orderId && !["completed", "cancelled"].includes(r.status));
  const blocked = disabled || busy || !current || Boolean(current.error);
  const rows = data.orders.map((order) => ({ order, task: serviceTask(order, units[order.id] || [], periodId) }))
    .filter(({ task }) => task.unfinished);
  const visible = rows.filter(({ order, task }) => task[filter] && `${order.customerName} ${order.gameId} ${order.orderNumber} ${order.customerLocation || ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(b.task.coordination) - Number(a.task.coordination) || Number(b.task.manager) - Number(a.task.manager) || a.order.submittedAt.localeCompare(b.order.submittedAt));
  const pages = Math.max(1, Math.ceil(visible.length / 12));
  const currentPage = Math.min(page, pages);
  const changeFilter = (next: ServiceFilter) => { setFilter(next); setPage(1); setWorkspace("tasks"); };
  const selectTaskMetric = (next: ServiceFilter) => {
    changeFilter(next);
    scrollTo(".serviceTasksPane");
  };
  const refresh = async () => { await onChanged(); setRevision((v) => v + 1); };
  const count = (f: ServiceFilter) => current && !current.error && !disabled ? rows.filter((r) => r.task[f]).length : "—";
  const selectGuest = (id: string) => {
    setSelected(id);
    setWorkspace("guests");
    scrollTo(".serviceGuestPanel");
  };
  const active = opened?.periodId === periodId ? opened : null;
  const activeOrder = active ? data.orders.find((order) => order.id === active.order.id) || active.order : null;
  const openOrder = (order: OperationsOrder) => {
    if (busy || pendingReceipt) return;
    setOpened({ order, periodId });
  };
  const clearTasks = () => { setSearch(""); changeFilter("unfinished"); };
  const taskConditions = search.trim() !== "" || filter !== "unfinished";
  // Preserve the existing independent-room scope; the search is for orders.
  const visibleRooms = filter === "unfinished" || filter === "room" ? standaloneRooms : [];
  const taskReady = !disabled && Boolean(current) && !current?.error;
  const activeOrderId = activeOrder?.id;
  useEffect(() => {
    if (!activeOrderId) return;
    const frame = requestAnimationFrame(() => document.getElementById("service-current-order")?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [activeOrderId]);
  return <div className="adminRoleDashboard adminRoleDashboard-service">
    <div className="adminPageHeading serviceWorkbenchHeading">
      <div><p className="eyebrow">{eyebrow}</p><h1 className="adminFieldHeading">服務員工作台<AdminHelp title="服務員工作台說明">顧客入場、確認訂單、包廂與現場協助。待辦依服務進度列示，服務完成不代表已收款；顧客搜尋保留跨期履約。</AdminHelp></h1></div>
    <WorkbenchShiftBar compact businessDate={date} staffId={user?.staffMemberId || ""} name={user?.displayName || "我的出勤"} periodStatus={data.context?.periodStatus || ""} disabled={blocked} onChanged={refresh} />
      <div className="servicePrimaryActions">{pageActions}</div>
    </div>
    <div className="adminRoleDashboardMetrics serviceMetrics">
      <button type="button" disabled={busy} aria-pressed={workspace === "tasks" && filter === "unfinished"} onClick={() => selectTaskMetric("unfinished")}><span>待處理訂單</span><strong>{count("unfinished")}</strong></button>
      <button type="button" disabled={busy} aria-pressed={workspace === "tasks" && filter === "coordination"} onClick={() => selectTaskMetric("coordination")}><span>協調單</span><strong>{count("coordination")}</strong></button>
      <button type="button" disabled={busy} aria-pressed={workspace === "tasks" && filter === "room"} onClick={() => selectTaskMetric("room")}><span>包廂待辦</span><strong>{typeof count("room") === "number" ? Number(count("room")) + standaloneRooms.length : "—"}</strong></button>
      <button type="button" disabled={busy} aria-pressed={workspace === "guests" && guestScope.entryScope === "open" && guestScope.periodScope === "current"} onClick={() => { setGuestScope({ entryScope: "open", periodScope: "current" }); selectGuest(selected); }}><span>開啟中的顧客</span><strong>{disabled ? "—" : data.sessions.filter((s) => s.businessPeriodId === periodId && s.status === "active" && s.entryStatus === "open").length}</strong></button>
    </div>
    <div className="serviceMetricHelp"><AdminHelp title="統計入口與計算範圍">待處理訂單：仍有現場作業的訂單。協調單：等待店家承接。包廂待辦：含獨立預約的未完成待辦。開啟中的顧客：本期入場且仍可點餐的顧客；點選套用本期、在場範圍，保留搜尋與已選顧客。各項可能重疊，不可相加；服務完成不代表已收款。點選待辦統計不會清除原有搜尋。</AdminHelp></div>
    {(actionState.error || actionState.message) && <p role={actionState.error ? "alert" : "status"}>{actionState.error || actionState.message}</p>}
    <div className="serviceWorkspaceTabs" role="tablist" aria-label="服務員工作區">
      {([ ["tasks", "現場待辦"], ["guests", "顧客處理"] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" id={`${workspaceId}-${value}-tab`} aria-controls={`${workspaceId}-${value}`} aria-selected={workspace === value} tabIndex={workspace === value ? 0 : -1} onClick={() => setWorkspace(value)} onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "tasks" : event.key === "End" ? "guests" : value === "tasks" ? "guests" : "tasks";
        setWorkspace(next); document.getElementById(`${workspaceId}-${next}-tab`)?.focus();
      }}>{label}</button>)}
    </div>
    <div className="serviceWorkspace" data-workspace={workspace}>
    <div className="serviceWorkspacePane serviceTasksPane" role="tabpanel" id={`${workspaceId}-tasks`} aria-labelledby={`${workspaceId}-tasks-tab`}>
    <AdminPanel className="adminRoleDashboardServiceCoordination" title={<span className="adminFieldHeading">現場待辦<AdminHelp title="現場待辦說明">展開訂單即可處理協調、餐點送達、包廂收尾與收款。此清單依服務進度列出待辦；服務完成不代表已收款。</AdminHelp></span>}>
      {(!taskReady || rows.length > 0 || standaloneRooms.length > 0 || taskConditions) && <><div className="serviceTaskFilters" role="group" aria-label="待辦分類">{([
        ["unfinished", "全部需處理"], ["coordination", "店家協調"], ["meal", "餐點"], ["room", "包廂"], ["manager", "待經理協調"],
      ] as const).map(([value, label]) => <AdminButton key={value} disabled={busy} variant={filter === value ? "primary" : "ghost"} aria-pressed={filter === value} onClick={() => changeFilter(value)}>{label} {count(value)}</AdminButton>)}</div>
      <AdminField className="serviceSearch" label="搜尋待辦"><input type="search" value={search} disabled={busy} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="顧客名稱、遊戲 ID、訂單編號或位置" /></AdminField>
      <div className="serviceConditionSummary"><span>{filter === "unfinished" ? "全部需處理" : filter === "coordination" ? "店家協調" : filter === "room" ? "包廂" : filter === "meal" ? "餐點" : "待經理協調"}{search.trim() ? ` · 搜尋「${search.trim()}」` : " · 未限定關鍵字"}</span>{taskConditions && <AdminButton variant="ghost" disabled={busy} onClick={clearTasks}>清除條件</AdminButton>}</div></>}
      {loadError ? <div role="alert"><p>{loadError}</p><AdminButton variant="secondary" onClick={() => void refresh()}>重新讀取工作台</AdminButton></div> : loading ? <p role="status">正在讀取工作台…</p> : !date ? <p>尚無可查看的營業期，仍可使用頁首操作與顧客搜尋。</p> : !current ? <p role="status">正在確認本期履約待辦…</p> : current.error ? <div role="alert"><p>{current.error}</p><AdminButton variant="secondary" onClick={() => setRevision((v) => v + 1)}>重試履約資料</AdminButton></div> : <>
        <div className="adminRoleDashboardRows">{visible.slice((currentPage - 1) * 12, currentPage * 12).map(({ order, task }) => <article className="serviceTaskRow" key={order.id}>
          <div className="serviceTaskHead"><div><strong>{order.customerName} · {order.gameId}</strong><small>{order.orderNumber} · {task.coordination ? "等待店家承接" : task.manager ? "需經理協調" : `剩餘 ${task.remaining} 項待處理`}</small><small>{order.customerLocation || "未提供位置"} · 下單至今 {Math.max(order.queueMinutes, Math.max(0, Math.floor((data.refreshedAt - Date.parse(order.submittedAt)) / 60_000)) || 0)} 分鐘</small></div>
            <div className="serviceTaskActions"><AdminButton disabled={disabled || busy || pendingReceipt} variant={activeOrder?.id === order.id ? "secondary" : "primary"} aria-expanded={activeOrder?.id === order.id} aria-controls="service-current-order" onClick={() => openOrder(order)}>{activeOrder?.id === order.id ? "處理面板已開啟" : "服務處理／收款"}</AdminButton><AdminButton variant="ghost" disabled={busy || pendingReceipt} onClick={() => selectGuest(order.sessionId)}>顧客操作</AdminButton></div>
          </div>
        </article>)}</div>
        {visibleRooms.length > 0 && <section className="serviceStandaloneRooms" aria-label="獨立包廂預約">
          <h3 className="adminFieldHeading">獨立包廂預約<AdminHelp title="獨立包廂搜尋範圍">獨立包廂未連結顧客訂單，沿用原有規則，不套用上方的訂單關鍵字搜尋。包廂統計包含這些未完成預約。</AdminHelp></h3>
          {!visible.length && search.trim() && <p>沒有符合關鍵字的訂單；下方仍保留獨立包廂待辦。</p>}
          {visibleRooms.map((room) => <StandaloneRoomTask key={room.id} room={room} date={date} now={data.refreshedAt} disabled={blocked} navigate={navigate} onChanged={refresh} onBusy={setBusy} />)}
        </section>}
        {!visible.length && !visibleRooms.length && <div className="serviceEmptyState"><p>{!rows.length && !standaloneRooms.length && !taskConditions ? "目前沒有現場待辦。可發點餐碼、訂購包廂或搜尋顧客。" : "沒有符合目前條件的待辦。"}</p></div>}
        {pages > 1 && <div className="serviceTaskPagination"><AdminButton variant="ghost" disabled={busy || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一頁</AdminButton><span>{currentPage}／{pages} 頁 · {visible.length} 張訂單</span><AdminButton variant="ghost" disabled={busy || currentPage >= pages} onClick={() => setPage(currentPage + 1)}>下一頁</AdminButton></div>}
      </>}
    </AdminPanel>
    </div>
    <div className="serviceWorkspacePane serviceGuestsPane" role="tabpanel" id={`${workspaceId}-guests`} aria-labelledby={`${workspaceId}-guests-tab`}>
      <ServiceGuestPanel data={data} user={user} selectedId={selected} onSelect={setSelected} disabled={disabled || busy || pendingReceipt} onBusy={setBusy} onChanged={refresh} onOpenOrder={openOrder} loading={loading} loadError={loadError} onRetry={refresh} scope={guestScope} onScopeChange={setGuestScope} />
    </div>
    </div>
    <div id="service-current-order" hidden={!activeOrder}>
      {activeOrder && <AdminPanel className="serviceCurrentOrder" title={`目前處理：${activeOrder.customerName} · ${activeOrder.orderNumber}`} actions={<AdminButton variant="ghost" disabled={busy || pendingReceipt} onClick={() => setOpened(null)}>關閉處理面板</AdminButton>}>
        {pendingReceipt && <p role="status">請先完成或查回目前的收款操作，再關閉或切換訂單。</p>}
        <ServiceOrderDetail key={`${periodId}:${activeOrder.id}`} order={activeOrder} disabled={disabled || busy} periodId={periodId} businessDate={date} refreshKey={data.refreshedAt} sourceMissing={!data.orders.some((order) => order.id === activeOrder.id)} onChanged={refresh} onBusy={setBusy} onPendingChange={setPendingReceipt} />
      </AdminPanel>}
    </div>
    <nav className="serviceQuickLinks" aria-label="其他管理入口"><span className="adminFieldHeading">其他管理<AdminHelp title="其他管理入口">完整訂單：完整點單、顧客與帳款管理。包廂管理：查看完整排程及例外處理。查詢訂單：跨日查詢與訂單明細。皆沿用目前營業日。</AdminHelp></span>{([ ["完整訂單", "/admin/orders"], ["包廂管理", "/admin/rooms/service"], ["查詢訂單", "/admin/order-list"] ] as const).map(([label, path]) => <AdminButton key={path} variant="ghost" disabled={busy} onClick={() => navigate(`${path}?${new URLSearchParams({ date })}`)}>{label}</AdminButton>)}</nav>
  </div>;
}
