"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminDialog, AdminField, AdminPage, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminRefreshButton } from "@/features/admin/shared/AdminRefreshButton";
import { DELIVERY_STATUS_LABELS } from "@/features/admin/customers/presentation";
import { useCustomerResource } from "@/features/admin/customers/useCustomerResource";
import type { ArtDelivery, DeliveryIssued } from "@/features/admin/customers/types";
import { CreateDeliveryPanel } from "./CreateDeliveryPanel";
import { DeliveryDetail } from "./DeliveryDetail";
import { isOverdue, nextAction } from "./presentation";
import { workspaceApi, type DeliveryScope } from "./workspaceApi";

export function AdminDeliveriesPage() {
  const parameters = useSearchParams();
  const requestedSession = parameters.get("session") || "";
  const requestedOrder = parameters.get("order") || "";
  const requestedDate = parameters.get("date") || "";
  const { user } = useAdminAuth();
  const canManage = user?.role === "manager" || user?.role === "developer";
  const [sessionId, setSessionId] = useState(requestedSession);
  const [showCreate, setShowCreate] = useState(Boolean(requestedSession && parameters.get("create") === "1"));
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", status: "", page: 1, scope: (requestedSession ? "all" : "mine") as DeliveryScope, sort: "due" });
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<ArtDelivery | null>(null);
  const [issued, setIssued] = useState<DeliveryIssued | null>(null);
  const [detailKey, setDetailKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const load = useCallback((signal: AbortSignal) => workspaceApi.list({ ...query, sessionId }, signal), [query, sessionId]);
  const { data, loading, error } = useCustomerResource(`${JSON.stringify(query)}:${sessionId}:${revision}`, load);
  const locked = busy || createBusy;
  const available = data?.available;
  const scope = available === false ? "all" : query.scope;
  const unsaved = dirty || createDirty;
  useEffect(() => {
    if (!unsaved) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [unsaved]);
  function clearDetail() { setSelected(null); setIssued(null); setDirty(false); setBusy(false); }
  function guarded(action: () => void) {
    if (locked) return;
    if (unsaved) { setPending(() => action); return; }
    action();
  }
  function changeQuery(update: Partial<typeof query>) { guarded(() => { clearDetail(); setQuery((value) => ({ ...value, ...update })); }); }
  function select(value: ArtDelivery) { guarded(() => { clearDetail(); setSelected(value); setDetailKey((key) => key + 1); }); }
  function changed(value: ArtDelivery) { setSelected(value); setRevision((count) => count + 1); }
  function created(value: DeliveryIssued) {
    setIssued(value); setSelected(value.delivery); setShowCreate(false); setCreateDirty(false); setCreateBusy(false);
    setDetailKey((key) => key + 1); setRevision((count) => count + 1);
  }
  return <AdminPage eyebrow="ART DELIVERY" title="繪圖／簽繪交付" description="追蹤自己的委託，核對作品內容，再將領取資料交給顧客。" actions={<a className="adminButton adminButton-secondary" href="/admin/customers" onClick={(event) => { if (unsaved || locked) { event.preventDefault(); guarded(() => { window.location.href = "/admin/customers"; }); } }}>從歷史顧客建立</a>}>
    <div className="adminDeliveryWorkspace">
      <AdminRefreshButton disabled={loading || locked} onClick={() => guarded(() => { clearDetail(); setRevision((count) => count + 1); })} />
      <AdminPanel title="交付工作台" description="負責人決定我的委託歸屬。未指派的歷史作品可在全部交付中核對。">
        <div className="adminDeliveryScopes" role="group" aria-label="交付範圍">{([["mine", "我的委託"], ["all", "全部交付"], ["unassigned", "尚未指派"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} disabled={locked || (available === false && value !== "all")} onClick={() => changeQuery({ scope: value, page: 1 })}>{label}</button>)}</div>
        <form className="adminCustomerFilters" onSubmit={(event) => { event.preventDefault(); changeQuery({ search: searchInput.trim(), page: 1 }); }}>
          <AdminField label="搜尋作品／顧客／ID"><input value={searchInput} maxLength={100} disabled={locked} onChange={(event) => setSearchInput(event.target.value)} placeholder="作品名稱、顧客或 UID" /></AdminField>
          <AdminField label="交付狀態"><select value={query.status} disabled={locked} onChange={(event) => changeQuery({ status: event.target.value, page: 1 })}><option value="">全部狀態</option>{Object.entries(DELIVERY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></AdminField>
          <AdminField label="排序"><select value={available === false ? "created" : query.sort} disabled={locked || available === false} onChange={(event) => changeQuery({ sort: event.target.value, page: 1 })}>{available === false ? <option value="created">建立時間，由新到舊</option> : <><option value="due">預計交付日，由近到遠</option><option value="updated">最近更新</option></>}</select></AdminField><button type="submit" className="adminButton adminButton-primary" disabled={loading || locked}>搜尋</button>
        </form>
        {sessionId ? <div className="adminCustomerActions"><span>目前限定此入場紀錄。</span><button type="button" className="adminButton adminButton-ghost" disabled={locked} onClick={() => guarded(() => { clearDetail(); setSessionId(""); setQuery((value) => ({ ...value, page: 1 })); })}>查看全部顧客</button><button type="button" className="adminButton adminButton-secondary" disabled={locked} onClick={() => guarded(() => setShowCreate(true))}>新增這位顧客的委託</button></div> : null}
      </AdminPanel>
      {available === false ? <p className="adminCustomerFeedback" role="status">工作台資料服務尚未啟用，目前顯示全部交付。既有編輯可使用；個人歸屬、領取碼檢視與通知紀錄待資料服務啟用。</p> : null}
      {error ? <div className="adminCustomerFeedback isError" role="alert">{error}<button type="button" className="adminButton adminButton-secondary" onClick={() => guarded(() => setRevision((count) => count + 1))}>重新載入</button></div> : null}
      {loading ? <p className="adminInlineState" role="status">正在載入交付工作台…</p> : null}
      <div className="adminDeliveryColumns">
        <section className="adminDeliveryQueue" aria-label="委託清單"><AdminPanel title={`${scope === "mine" ? "我的委託" : scope === "unassigned" ? "尚未指派" : "全部交付"}${data ? ` · ${data.totalCount === null ? `本頁 ${data.items.length}` : data.totalCount} 件` : ""}`}>
          <div className="adminDeliveryQueueList">{data?.items.map((delivery) => <button key={delivery.id} type="button" className={`adminDeliveryQueueItem ${selected?.id === delivery.id ? "isSelected" : ""}`} aria-pressed={selected?.id === delivery.id} disabled={locked} onClick={() => select(delivery)}>
            <span className="adminDeliveryQueueHeading"><strong>{delivery.title}</strong><span className={`adminDeliveryStatus is-${delivery.status}`}>{DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}</span></span><span>{delivery.customerName} · {delivery.gameId}</span><span className="adminDeliveryQueueMeta">{delivery.assignedStaffName || (available ? "尚未指派" : "負責人資料待啟用")} · 預計 {delivery.dueDate?.slice(0, 10) || "未設定"}</span>{isOverdue(delivery) ? <span className="adminDeliveryOverdue">已超過預計交付日</span> : null}<span className="adminDeliveryQueueNext">{nextAction(delivery)}</span>
          </button>)}</div>
          {data?.items.length === 0 ? <p className="adminEmptyText">{scope === "mine" ? "尚無指派給你的委託，可切換全部交付核對負責人。" : "沒有符合條件的委託。"}</p> : null}
          <div className="adminDeliveryPagination"><button type="button" className="adminButton adminButton-ghost" disabled={loading || locked || query.page <= 1} onClick={() => changeQuery({ page: query.page - 1 })}>上一頁</button><span>第 {query.page} 頁</span><button type="button" className="adminButton adminButton-ghost" disabled={loading || locked || !data || (data.totalCount === null ? data.items.length < data.pageSize : query.page * data.pageSize >= data.totalCount)} onClick={() => changeQuery({ page: query.page + 1 })}>下一頁</button></div>
        </AdminPanel></section>
        <section className="adminDeliveryDetail" aria-label="作品詳情">{selected ? <DeliveryDetail key={`${selected.id}:${detailKey}`} initial={selected} staff={data?.staff || []} canManage={canManage} initialCode={issued?.delivery.id === selected.id ? issued.claimCode : null} onChanged={changed} onIssued={(value) => { setIssued(value); changed(value.delivery); }} onDirty={setDirty} onBusy={setBusy} onClose={() => guarded(clearDetail)} /> : <AdminPanel title="選擇一筆委託"><p className="adminEmptyText">從左側選擇作品，檢視內容、領取資料與處理紀錄。</p></AdminPanel>}</section>
      </div>
    </div>
    <AdminDialog open={showCreate} title="建立待交付作品" description="核對來源顧客後，建立獨立委託與單筆領取碼。" onClose={() => guarded(() => setShowCreate(false))} actions={null}>{showCreate && data ? <CreateDeliveryPanel key={createKey} sessionId={requestedSession} orderId={requestedOrder} businessDate={requestedDate} staff={data.staff} defaultStaffId={user?.staffMemberId || ""} available={data.available} onIssued={created} onDirty={setCreateDirty} onBusy={setCreateBusy} /> : <p role="status">{error || "正在讀取建立委託所需資料…"}</p>}</AdminDialog>
    <AdminDialog open={pending !== null} title="放棄尚未儲存的內容？" description="切換後，作品修改及尚未送出的附件會被清除。" onClose={() => setPending(null)} actions={null}><div className="adminCustomerActions"><button type="button" className="adminButton adminButton-secondary" onClick={() => setPending(null)}>繼續編輯</button><button type="button" className="adminButton adminButton-primary" onClick={() => { const action = pending; setPending(null); clearDetail(); setCreateDirty(false); setCreateKey((key) => key + 1); action?.(); }}>放棄修改並繼續</button></div></AdminDialog>
  </AdminPage>;
}
