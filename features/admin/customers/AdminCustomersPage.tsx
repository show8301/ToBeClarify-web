"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminDialog, AdminField, AdminPage, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { customerApi } from "./api";
import { formatCustomerTime, formatMoney, queryPath } from "./presentation";
import { useCustomerResource } from "./useCustomerResource";
import { useCustomerMutation } from "./useCustomerMutation";
import type { CustomerIdentityCandidate, CustomerVisit } from "./types";

export function AdminCustomersPage() {
  const [dateInput, setDateInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({ businessDate: "", search: "", page: 1 });
  const [revision, setRevision] = useState(0);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<CustomerVisit | null>(null);
  const load = useCallback((signal: AbortSignal) => customerApi.history(query, signal), [query]);
  const { data, loading, error } = useCustomerResource(`${JSON.stringify(query)}:${revision}`, load);
  const { user } = useAdminAuth();
  const canManage = user?.role === "manager" || user?.role === "developer";

  function changed() {
    setSelectedVisit(null);
    setRevision((value) => value + 1);
  }

  return <AdminPage eyebrow="CUSTOMER HISTORY" title="歷史顧客" description="依營業日找回入場紀錄、訂單與作品交付；以長期 UID 累積跨日紀錄。" actions={<Link className="adminButton adminButton-secondary" href="/admin/deliveries">作品交付管理</Link>}>
    <div className="adminCustomers">
      <AdminPanel title="查詢入場紀錄" description="營業日留空可跨日查詢。填寫 ID 是顧客自填資料；同名或同 ID 的紀錄不會自動合併 UID。">
        <form className="adminCustomerFilters" onSubmit={(event) => { event.preventDefault(); setQuery({ businessDate: dateInput, search: searchInput.trim(), page: 1 }); }}>
          <AdminField label="營業日"><input type="date" value={dateInput} onChange={(event) => setDateInput(event.target.value)} /></AdminField>
          <AdminField label="顧客名稱／填寫 ID／UID"><input value={searchInput} maxLength={100} onChange={(event) => setSearchInput(event.target.value)} placeholder="輸入顧客線索" /></AdminField>
          <button type="submit" className="adminButton adminButton-primary" disabled={loading}>查詢</button>
          <button type="button" className="adminButton adminButton-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>重新整理</button>
        </form>
      </AdminPanel>
      {error ? <div className="adminCustomerFeedback isError" role="alert">{error}</div> : null}
      {loading ? <p className="adminInlineState" role="status">正在讀取歷史顧客…</p> : null}
      {data ? <AdminPanel title={`入場紀錄 · ${data.totalCount} 筆`}>
        <div className="adminCustomerTableWrap"><table className="adminCustomerTable">
          <thead><tr><th>營業日／入場</th><th>顧客／UID</th><th>當日訂單</th><th>找回碼狀態</th><th>實收淨額</th><th>填寫 ID 參考</th><th>操作</th></tr></thead>
          <tbody>{data.items.map((visit) => <tr key={visit.sessionId}>
            <td><strong>{visit.businessDate.slice(0, 10)}</strong><small>{formatCustomerTime(visit.createdAt)}</small><small>{entryLabel(visit.entryStatus)}</small></td>
            <td><strong>{visit.customerName}</strong><small>填寫 ID：{visit.gameId || "未填寫"}</small>{visit.customerUid ? <button className="adminCustomerUid" type="button" onClick={() => setSelectedUid(visit.customerUid)}>{visit.customerUid}</button> : <small>尚未綁定長期 UID</small>}</td>
            <td><strong>{visit.orderCount} 單 · {formatMoney(visit.orderAmount)}</strong><small>未完成作品 {visit.pendingDeliveryCount} 件</small></td>
            <td><strong>{visit.hasRecoveryCode ? "已建立" : "未建立"}</strong><small>第 {visit.recoveryCodeVersion || 1} 版</small>{visit.recoveryCodeIssuedAt ? <small>發行 {formatCustomerTime(visit.recoveryCodeIssuedAt)}</small> : null}</td>
            <td><strong>{visit.hasCashRecords ? formatMoney(visit.netReceived) : "尚無收退款紀錄"}</strong><small>依帳款紀錄扣除退款</small></td>
            <td><strong>{visit.gameIdVisitCount} 次入場</strong><small>{formatMoney(visit.gameIdOrderAmount)} 訂單金額</small><small>自填 ID 群組，未驗證身分</small></td>
            <td><div className="adminCustomerRowActions">
              <Link className="adminButton adminButton-secondary" href={queryPath("/admin/order-list", { date: visit.businessDate.slice(0, 10), session: visit.sessionId })}>歷史訂單</Link>
              <Link className="adminButton adminButton-secondary" href={queryPath("/admin/deliveries", { session: visit.sessionId, date: visit.businessDate.slice(0, 10), create: "1" })}>建立作品交付</Link>
              {!visit.customerUid ? <button className="adminButton adminButton-ghost" type="button" onClick={() => setSelectedVisit(visit)}>建立／綁定 UID</button> : null}
            </div></td>
          </tr>)}</tbody>
        </table></div>
        {!data.items.length ? <p className="adminEmptyText">找不到符合條件的顧客，請調整營業日或搜尋文字。</p> : null}
        <div className="adminCustomerActions">
          <button className="adminButton adminButton-secondary" type="button" disabled={query.page <= 1} onClick={() => setQuery((value) => ({ ...value, page: value.page - 1 }))}>上一頁</button>
          <span>第 {data.page} 頁，共 {Math.max(1, Math.ceil(data.totalCount / data.pageSize))} 頁</span>
          <button className="adminButton adminButton-secondary" type="button" disabled={data.page * data.pageSize >= data.totalCount} onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))}>下一頁</button>
        </div>
      </AdminPanel> : null}
      {selectedUid ? <CustomerDetails key={`${selectedUid}:${revision}`} uid={selectedUid} onClose={() => setSelectedUid(null)} onViewHistory={() => { setSearchInput(selectedUid); setDateInput(""); setQuery({ businessDate: "", search: selectedUid, page: 1 }); }} /> : null}
      {selectedVisit ? <LinkProfileDialog key={selectedVisit.sessionId} visit={selectedVisit} canManage={canManage} onChanged={changed} onClose={() => setSelectedVisit(null)} /> : null}
    </div>
  </AdminPage>;
}

function entryLabel(value: string) {
  return ({ pending: "待入場", open: "入場開放中", departed: "已離店", entered: "已入場", checked_in: "已入場", admitted: "已入場", cancelled: "已取消", left: "已離店" } as Record<string, string>)[value] || value || "未記錄入場狀態";
}

function LinkProfileDialog({ visit, canManage, onChanged, onClose }: { visit: CustomerVisit; canManage: boolean; onChanged: () => void; onClose: () => void }) {
  const [uid, setUid] = useState("");
  const [candidates, setCandidates] = useState<CustomerIdentityCandidate[]>([]);
  const [candidateError, setCandidateError] = useState("");
  const { busy, error, perform } = useCustomerMutation();
  useEffect(() => {
    const controller = new AbortController();
    void customerApi.candidates(visit.gameId, controller.signal)
      .then((result) => setCandidates(result.items))
      .catch((reason) => { if (!controller.signal.aborted) setCandidateError(reason instanceof Error ? reason.message : "無法載入 UID 候選。"); });
    return () => controller.abort();
  }, [visit.gameId]);
  return <AdminDialog open title={`顧客 UID · ${visit.customerName}`} description="第一次使用可建立新的長期 UID。綁定既有 UID 前，請由店經理核對顧客資料。" onClose={() => { if (!busy) onClose(); }} actions={null}>
    <form className="adminCustomerForm" onSubmit={(event) => { event.preventDefault(); void perform((signal) => customerApi.linkProfile(visit.sessionId, uid.trim() || null, signal), onChanged); }}>
      <p>營業日：{visit.businessDate.slice(0, 10)} · 填寫 ID：{visit.gameId}</p>
      {candidateError ? <p role="alert">{candidateError}</p> : null}
      {candidates.length ? <div className="adminCustomerCandidateList"><p>找到以下歷史 UID 候選，請先核對後選擇：</p>{canManage ? candidates.map((candidate) => <button key={candidate.uid} type="button" className={`adminButton ${uid === candidate.uid ? "adminButton-primary" : "adminButton-secondary"}`} onClick={() => setUid(candidate.uid)}><strong>{candidate.displayName}</strong> · {candidate.uid}<small>{candidate.visitCount} 次來店 · {candidate.orderCount} 單</small></button>) : <p className="adminCustomerHint">目前帳號只能建立新 UID；既有 UID 的跨紀錄歸戶需由店經理核對。</p>}</div> : <p className="adminCustomerHint">此遊戲 ID 尚未找到已歸戶 UID，送出後會建立新的 UID。</p>}
      {canManage ? <AdminField label="既有 UID（留空即建立新 UID）"><input value={uid} maxLength={40} onChange={(event) => setUid(event.target.value)} /></AdminField> : <p>本操作會建立新 UID；跨紀錄綁定既有 UID 由店經理處理。</p>}
      {error ? <p role="alert" className="adminCustomerFeedback isError">{error}</p> : null}
      <button type="submit" className="adminButton adminButton-primary" disabled={busy}>{busy ? "處理中…" : uid.trim() ? "確認綁定既有 UID" : "建立 UID"}</button>
    </form>
  </AdminDialog>;
}

function CustomerDetails({ uid, onClose, onViewHistory }: { uid: string; onClose: () => void; onViewHistory: () => void }) {
  const [revision, setRevision] = useState(0);
  const load = useCallback((signal: AbortSignal) => customerApi.detail(uid, signal), [uid]);
  const { data, loading, error } = useCustomerResource(`${uid}:${revision}`, load);
  return <AdminPanel title="UID 跨日紀錄" description={`顧客 UID：${uid}`} actions={<button type="button" className="adminButton adminButton-ghost" onClick={onClose}>收合</button>}>
    {loading ? <p role="status">正在讀取跨日紀錄…</p> : null}
    {error ? <div role="alert"><p>{error}</p><button type="button" className="adminButton adminButton-secondary" onClick={() => setRevision((value) => value + 1)}>重試</button></div> : null}
    {data ? <>
      <h3>{data.profile.displayName}</h3>
      <dl className="adminCustomerMetrics">
        <div><dt>入場次數</dt><dd>{data.summary.visitCount}</dd></div>
        <div><dt>訂單數</dt><dd>{data.summary.orderCount}</dd></div>
        <div><dt>訂單金額</dt><dd>{formatMoney(data.summary.orderAmount)}</dd></div>
        <div><dt>實收扣退款</dt><dd>{formatMoney(data.summary.netReceived)}</dd></div>
        <div><dt>待交付作品</dt><dd>{data.summary.pendingDeliveryCount}</dd></div>
      </dl>
      <p className="adminCustomerHint">實收淨額只加總收退款紀錄；歷史資料若未登錄收款，不推定已收款。填寫 ID 可供查詢，CRM 歸戶以明確綁定的 UID 為準。</p>
      <div className="adminCustomerActions"><span className="adminCustomerHint">以下顯示最近 200 筆入場紀錄，摘要統計包含全部歷史。</span><button type="button" className="adminButton adminButton-secondary" onClick={onViewHistory}>以此 UID 查詢全部歷史</button></div>
      <div className="adminCustomerVisitList">{data.visits.map((visit) => <article key={visit.sessionId}>
        <strong>{visit.businessDate.slice(0, 10)} · {visit.customerName}</strong>
        <span>{visit.gameId} · {visit.orderCount} 單 · {formatMoney(visit.orderAmount)}</span>
        <small>{visit.hasRecoveryCode ? "找回碼已建立，第 " + visit.recoveryCodeVersion + " 版" + (visit.recoveryCodeIssuedAt ? " · " + formatCustomerTime(visit.recoveryCodeIssuedAt) : "") : "尚未建立找回碼"}</small>
        <Link className="adminButton adminButton-secondary" href={queryPath("/admin/order-list", { date: visit.businessDate.slice(0, 10), session: visit.sessionId })}>查看當日訂單</Link>
      </article>)}</div>
    </> : null}
  </AdminPanel>;
}
