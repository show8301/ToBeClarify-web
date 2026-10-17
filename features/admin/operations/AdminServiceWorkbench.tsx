"use client";

import { useEffect, useState } from "react";
import { adminRequest } from "@/features/admin/api/client.js";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { WorkbenchShiftBar } from "./WorkbenchShiftBar";
import { ServiceGuestPanel } from "./ServiceGuestPanel";
import { ServiceOrderDetail } from "./ServiceOrderDetail";
import { StandaloneRoomTask } from "./StandaloneRoomTask";
import { serviceTask } from "./serviceQueue";
import type { ServiceFilter } from "./serviceQueue";
import { list, parseUnits, record, textValue } from "./workbenchApi";
import type { WorkbenchUnit } from "./workbenchApi";
import type { CurrentAdminUser, OperationsAction, OperationsActionState, OperationsData } from "./operationsTypes";

export function AdminServiceDashboard({ data, user, navigate, actionState, onChanged, disabled }: {
  data: OperationsData; user?: CurrentAdminUser; navigate: (route: string) => void; runAction: OperationsAction;
  actionState: OperationsActionState; onChanged: () => Promise<void>; disabled: boolean;
}) {
  const date = data.context?.referenceBusinessDate || "";
  const periodId = data.context?.businessPeriodId || "";
  const [filter, setFilter] = useState<ServiceFilter>("unfinished");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
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
  const changeFilter = (next: ServiceFilter) => { setFilter(next); setPage(1); };
  const refresh = async () => { await onChanged(); setRevision((v) => v + 1); };
  const count = (f: ServiceFilter) => current && !current.error && !disabled ? rows.filter((r) => r.task[f]).length : "—";
  const selectGuest = (id: string) => {
    setSelected(id);
    document.querySelector(".serviceGuestPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return <div className="adminRoleDashboard adminRoleDashboard-service">
    <WorkbenchShiftBar businessDate={date} staffId={user?.staffMemberId || ""} name={user?.displayName || "我的出勤"} periodStatus={data.context?.periodStatus || ""} disabled={blocked} onChanged={refresh} />
    <div className="adminRoleDashboardMetrics serviceMetrics">
      <button type="button" disabled={busy} onClick={() => changeFilter("unfinished")}><span>待處理訂單</span><strong>{count("unfinished")}</strong><small>仍有現場作業的訂單</small></button>
      <button type="button" disabled={busy} onClick={() => changeFilter("coordination")}><span>協調單</span><strong>{count("coordination")}</strong><small>等待店家承接</small></button>
      <button type="button" disabled={busy} onClick={() => changeFilter("room")}><span>包廂待辦</span><strong>{typeof count("room") === "number" ? Number(count("room")) + standaloneRooms.length : "—"}</strong><small>含獨立預約的未完成待辦</small></button>
      <button type="button" disabled={busy} onClick={() => selectGuest("")}><span>開啟中的顧客</span><strong>{disabled ? "—" : data.sessions.filter((s) => s.businessPeriodId === periodId && s.status === "active" && s.entryStatus === "open").length}</strong><small>進入顧客現場處理</small></button>
    </div>
    {(actionState.error || actionState.message) && <p role={actionState.error ? "alert" : "status"}>{actionState.error || actionState.message}</p>}
    <AdminPanel className="adminRoleDashboardServiceCoordination" title="現場待辦" description="展開訂單即可處理協調、餐點送達、包廂收尾與收款。">
      <div className="serviceTaskFilters" role="group" aria-label="待辦分類">{([
        ["unfinished", "全部需處理"], ["coordination", "店家協調"], ["meal", "餐點"], ["room", "包廂"], ["manager", "待經理協調"],
      ] as const).map(([value, label]) => <AdminButton key={value} disabled={busy} variant={filter === value ? "primary" : "ghost"} aria-pressed={filter === value} onClick={() => changeFilter(value)}>{label} {count(value)}</AdminButton>)}</div>
      <label className="serviceSearch">搜尋待辦<input value={search} disabled={busy} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="顧客、訂單或位置" /></label>
      {!current ? <p role="status">正在確認本期履約待辦…</p> : current.error ? <div role="alert"><p>{current.error}</p><AdminButton variant="secondary" onClick={() => setRevision((v) => v + 1)}>重試履約資料</AdminButton></div> : <>
        <div className="adminRoleDashboardRows">{visible.slice((currentPage - 1) * 12, currentPage * 12).map(({ order, task }) => <article className="serviceTaskRow" key={order.id}>
          <div className="serviceTaskHead"><div><strong>{order.customerName} · {order.gameId}</strong><small>{order.orderNumber} · {task.coordination ? "等待店家承接" : task.manager ? "需經理協調" : `剩餘 ${task.remaining} 項待處理`}</small><small>{order.customerLocation || "未提供位置"} · 下單至今 {Math.max(order.queueMinutes, Math.max(0, Math.floor((data.refreshedAt - Date.parse(order.submittedAt)) / 60_000)) || 0)} 分鐘</small></div>
            <div className="serviceTaskActions"><AdminButton disabled={blocked} variant={expanded === order.id ? "secondary" : "primary"} aria-expanded={expanded === order.id} onClick={() => setExpanded(expanded === order.id ? "" : order.id)}>{expanded === order.id ? "收起明細" : "展開處理"}</AdminButton><AdminButton variant="ghost" disabled={busy} onClick={() => selectGuest(order.sessionId)}>顧客操作</AdminButton></div>
          </div>
          {expanded === order.id && <ServiceOrderDetail order={order} units={units[order.id] || []} disabled={blocked} periodId={periodId} businessDate={date} staffId={user?.staffMemberId || ""} onChanged={refresh} onBusy={setBusy} />}
        </article>)}</div>
        {(filter === "unfinished" || filter === "room") && standaloneRooms.map((room) => <StandaloneRoomTask key={room.id} room={room} date={date} now={data.refreshedAt} disabled={blocked} navigate={navigate} onChanged={refresh} onBusy={setBusy} />)}
        {!visible.length && (!(filter === "unfinished" || filter === "room") || !standaloneRooms.length) && <p>此分類目前沒有待辦。</p>}
        {pages > 1 && <div className="serviceTaskPagination"><AdminButton variant="ghost" disabled={busy || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一頁</AdminButton><span>{currentPage}／{pages} 頁 · {visible.length} 張訂單</span><AdminButton variant="ghost" disabled={busy || currentPage >= pages} onClick={() => setPage(currentPage + 1)}>下一頁</AdminButton></div>}
      </>}
    </AdminPanel>
    <ServiceGuestPanel data={data} user={user} units={units} selectedId={selected} onSelect={setSelected} disabled={blocked} onBusy={setBusy} onChanged={refresh} />
    <AdminPanel className="adminRoleDashboardServiceQuickLinks" title="現場快速入口" description="進入完整管理或跨日查詢。" actions={<><AdminButton disabled={busy} onClick={() => navigate(`/admin/orders?${new URLSearchParams({ date })}`)}>完整訂單</AdminButton><AdminButton disabled={busy} variant="secondary" onClick={() => navigate(`/admin/rooms/service?${new URLSearchParams({ date })}`)}>包廂管理</AdminButton><AdminButton disabled={busy} variant="ghost" onClick={() => navigate(`/admin/order-list?${new URLSearchParams({ date })}`)}>查詢訂單</AdminButton></>} />
  </div>;
}
