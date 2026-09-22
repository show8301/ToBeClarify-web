"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminField, AdminPage, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { customerApi } from "@/features/admin/customers/api";
import { IssuedClaimCode } from "@/features/admin/customers/IssuedClaimCode";
import { DELIVERY_STATUS_LABELS, formatCustomerTime, queryPath } from "@/features/admin/customers/presentation";
import { useCustomerResource } from "@/features/admin/customers/useCustomerResource";
import { useCustomerMutation } from "@/features/admin/customers/useCustomerMutation";
import { DeliveryEditor } from "./DeliveryEditor";
import type { ArtDelivery, DeliveryIssued } from "@/features/admin/customers/types";

export function AdminDeliveriesPage() {
  const parameters = useSearchParams();
  const requestedSession = parameters.get("session") || "";
  const requestedOrder = parameters.get("order") || "";
  const requestedDate = parameters.get("date") || "";
  const [sessionId, setSessionId] = useState(requestedSession);
  const [showCreate, setShowCreate] = useState(Boolean(requestedSession && parameters.get("create") === "1"));
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", status: "", page: 1 });
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<ArtDelivery | null>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [issued, setIssued] = useState<DeliveryIssued | null>(null);
  const { user } = useAdminAuth();
  const canManage = user?.role === "manager" || user?.role === "developer";
  const load = useCallback((signal: AbortSignal) => customerApi.deliveries({ ...query, sessionId }, signal), [query, sessionId]);
  const { data, loading, error } = useCustomerResource(`${JSON.stringify(query)}:${sessionId}:${revision}`, load);

  function changed(delivery: ArtDelivery) {
    setSelected(delivery);
    setRevision((value) => value + 1);
  }
  function onIssued(value: DeliveryIssued) {
    setIssued(value);
    setShowCreate(false);
    changed(value.delivery);
  }

  return <AdminPage eyebrow="ART DELIVERY" title="繪圖／簽繪交付" description="將當日消費與日後作品分開追蹤，作品完成後再開放顧客領取。" actions={<Link className="adminButton adminButton-secondary" href="/admin/customers">從歷史顧客建立</Link>}>
    <div className="adminCustomers">
      {issued ? <IssuedClaimCode key={issued.claimCode} title={`單筆領取碼 · ${issued.delivery.title}`} value={issued.claimCode} collectionLink onClose={() => setIssued(null)} /> : null}
      {requestedSession && showCreate ? <CreateDeliveryPanel sessionId={requestedSession} orderId={requestedOrder} businessDate={requestedDate} onIssued={onIssued} onClose={() => setShowCreate(false)} /> : null}
      <AdminPanel title="交付清單" description="領取碼僅開啟單筆委託。顧客也能用 UID 查看自己綁定的作品；當日點餐找回碼不作為作品存取憑證。">
        <form className="adminCustomerFilters" onSubmit={(event) => { event.preventDefault(); setQuery((value) => ({ ...value, search: searchInput.trim(), page: 1 })); }}>
          <AdminField label="搜尋作品／顧客／填寫 ID"><input value={searchInput} maxLength={100} onChange={(event) => setSearchInput(event.target.value)} placeholder="輸入作品或顧客線索" /></AdminField>
          <AdminField label="交付狀態"><select value={query.status} onChange={(event) => setQuery((value) => ({ ...value, status: event.target.value, page: 1 }))}><option value="">全部狀態</option>{Object.entries(DELIVERY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></AdminField>
          <button type="submit" className="adminButton adminButton-primary" disabled={loading}>搜尋</button>
          <button type="button" className="adminButton adminButton-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>重新整理清單</button>
        </form>
        {sessionId ? <div className="adminCustomerActions"><span>目前顯示指定入場紀錄的委託。</span><button type="button" className="adminButton adminButton-ghost" onClick={() => { setSessionId(""); setQuery((value) => ({ ...value, page: 1 })); }}>查看全部顧客</button>{!showCreate ? <button type="button" className="adminButton adminButton-secondary" onClick={() => setShowCreate(true)}>新增這位顧客的委託</button> : null}</div> : null}
      </AdminPanel>
      {error ? <p className="adminCustomerFeedback isError" role="alert">{error}</p> : null}
      {loading ? <p className="adminInlineState" role="status">正在載入作品交付…</p> : null}
      {data ? <AdminPanel title={`委託作品 · 第 ${query.page} 頁，本頁 ${data.length} 件`}>
        <div className="adminDeliveryList">{data.map((delivery) => <article key={delivery.id} className={selected?.id === delivery.id ? "isSelected" : ""}>
          <div><span className={`adminDeliveryStatus is-${delivery.status}`}>{DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}</span><h3>{delivery.title}</h3><p>{delivery.customerName} · ID {delivery.gameId}</p><small>{delivery.businessDate.slice(0, 10)} · {delivery.orderNumber || "綁定入場紀錄"}</small></div>
          <div><span>預計交付 {delivery.dueDate?.slice(0, 10) || "未設定"}</span><small>{delivery.assets.length} 個附件 · 更新 {formatCustomerTime(delivery.updatedAt)}</small><button type="button" className="adminButton adminButton-secondary" onClick={() => { setSelected(delivery); setSelectionVersion((value) => value + 1); }}>管理交付</button></div>
        </article>)}</div>
        {!data.length ? <p className="adminEmptyText">尚無符合條件的委託。請從歷史顧客或訂單明細建立作品交付。</p> : null}
        <div className="adminCustomerActions">
          <button type="button" className="adminButton adminButton-secondary" disabled={query.page <= 1} onClick={() => setQuery((value) => ({ ...value, page: value.page - 1 }))}>上一頁</button>
          <span>第 {query.page} 頁 · 每頁最多 30 件</span>
          <button type="button" className="adminButton adminButton-secondary" disabled={data.length < 30} onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))}>下一頁</button>
        </div>
      </AdminPanel> : null}
      {selected ? <DeliveryEditor key={`${selected.id}:${selectionVersion}`} initial={selected} canManage={canManage} onChanged={changed} onIssued={onIssued} onClose={() => setSelected(null)} /> : null}
    </div>
  </AdminPage>;
}

function CreateDeliveryPanel({ sessionId, orderId, businessDate, onIssued, onClose }: { sessionId: string; orderId: string; businessDate: string; onIssued: (value: DeliveryIssued) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const { busy, error, perform } = useCustomerMutation();
  return <AdminPanel title="建立待交付作品" description="建立後立即產生單筆領取碼，請交給顧客保存；作品在設為可領取前不會向顧客公開。" actions={<button type="button" className="adminButton adminButton-ghost" disabled={busy} onClick={onClose}>收合</button>}>
    <form className="adminCustomerForm" onSubmit={(event) => { event.preventDefault(); void perform((signal) => customerApi.createDelivery({ sessionId, orderId: orderId || null, title: title.trim(), description: description.trim() || null, dueDate: dueDate || null }, signal), onIssued); }}>
      <p className="adminCustomerHint">綁定來源：{businessDate || "所選營業日"} 的入場紀錄{orderId ? "及指定訂單" : ""}。建立前可先核對顧客與訂單內容。</p>
      <AdminField label="作品／服務名稱" required><input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：雙人半身繪圖委託" /></AdminField>
      <AdminField label="顧客可見說明"><textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="交付內容、尺寸或其他顧客需要知道的事項" /></AdminField>
      <AdminField label="預計交付日"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></AdminField>
      {error ? <p className="adminCustomerFeedback isError" role="alert">{error} 若是連線中斷，請先重新整理交付清單確認是否已建立；領取碼未保存時可由店經理補發。</p> : null}
      <div className="adminCustomerActions"><button type="submit" className="adminButton adminButton-primary" disabled={busy || !title.trim()}>{busy ? "建立中…" : "建立作品並產生領取碼"}</button><Link className="adminButton adminButton-ghost" href={queryPath("/admin/order-list", { session: sessionId, date: businessDate, order: orderId })}>核對來源顧客</Link></div>
    </form>
  </AdminPanel>;
}
