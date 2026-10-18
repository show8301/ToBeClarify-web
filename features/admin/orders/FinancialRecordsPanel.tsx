"use client";

import { useEffect, useState } from "react";
import { financeApi, financeKind, financeSource } from "./finance-api";
import type { FinanceAccount, FinanceOrderOption, FinancePeriodOption, FinanceRecord, FinanceSaveRequest } from "./finance-types";
import { AdmissionAndCasesPanel } from "./AdmissionAndCasesPanel";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";

const kindLabels = { charge_add: "加收應付", charge_reduce: "折讓應付", cash_receipt: "實際收款", cash_refund: "實際退款" };
const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;
function taiwanInput(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + 8 * 3600000).toISOString().slice(0, 16) : "";
}

export function FinancialRecordsPanel({ sessionId, refreshKey }: { sessionId: string; refreshKey?: string }) {
  const [account, setAccount] = useState<FinanceAccount | null>(null);
  const [periods, setPeriods] = useState<FinancePeriodOption[]>([]);
  const [orders, setOrders] = useState<FinanceOrderOption[]>([]);
  const [admission, setAdmission] = useState<import("./finance-types").AdmissionEntry | null>(null);
  const [cases, setCases] = useState<import("./finance-types").FinanceCase[]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<FinanceRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const requestKey = `${sessionId}:${revision}:${refreshKey ?? ""}`;
  const [settledRequest, setSettledRequest] = useState("");
  const loading = settledRequest !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([financeApi.account(sessionId, controller.signal), financeApi.periods(sessionId, controller.signal), financeApi.orders(sessionId, controller.signal), financeApi.admission(sessionId, controller.signal), financeApi.cases(sessionId, false, controller.signal)])
      .then(([a, p, o, admissionEntry, financeCases]) => { setAccount(a); setPeriods(p); setOrders(o); setAdmission(admissionEntry); setCases(financeCases); setError(""); })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setSettledRequest(requestKey); });
    return () => controller.abort();
  }, [sessionId, requestKey]);
  return <section className="adminOrderCard adminOrderFinance" aria-label="現場帳款" aria-busy={loading}>
    <header className="adminOrderFinanceHeading">
      <div className="adminOrderHeadingWithHelp"><h3>現場帳款</h3><AdminHelp title="現場帳款說明">加收、折讓用於調整應付金額；實收、實退用於記錄實際收退款。取消餐點會自動扣除應付，請勿重複登記折讓。</AdminHelp></div>
      <AdminButton variant="ghost" disabled={loading} onClick={() => setRevision(n => n + 1)}>{loading ? "讀取中…" : "重新讀取帳款"}</AdminButton>
    </header>
    {error && <p className="adminOrderFinanceNotice isError" role="alert">{error}</p>}
    {!account && loading && <p className="adminOrderFinanceNotice" role="status">正在讀取帳款…</p>}
    {account && <>
      <div className="adminOrderFinanceOverview">
        <div className="adminOrderFinanceBalance">
          <span>{account.balance >= 0 ? "尚待收取" : "待退款"}{account.balanceIsProvisional ? "（暫計）" : ""}</span>
          <strong>{money(account.balance >= 0 ? account.balance : account.refundDue)}</strong>
          <div className="adminOrderFinanceFlags"><span>待確認 {account.pendingCount} 筆</span>{account.holdScope !== "none" && <span>分潤保留</span>}</div>
        </div>
        <dl className="adminOrderFinanceMetrics">
          <div><dt>應收</dt><dd>{money(account.receivable)}</dd></div>
          <div><dt>實收</dt><dd>{money(account.cashReceived)}</dd></div>
          <div><dt>退款</dt><dd>{money(account.cashRefunded)}</dd></div>
          <div><dt>淨收</dt><dd>{money(account.netCash)}</dd></div>
        </dl>
      </div>
      {account.balanceIsProvisional && <p className="adminOrderFinanceNotice">金額仍待補齊或確認。入場費須登記應付，實際收退款各自記錄。</p>}
      {account.canWrite && <AdmissionAndCasesPanel sessionId={sessionId} account={account} periods={periods} admission={admission} cases={cases} onSaved={() => setRevision(n => n + 1)} />}
      <div className="adminOrderFinanceRecordHeading">
        <div className="adminOrderFinanceRecordHeadingTitle">
          <h4>帳款紀錄</h4>
          <AdminHelp title="帳款紀錄說明">查看已登記款項與確認狀態。</AdminHelp>
          <span className="adminOrderFinanceRecordCount">{account.records.length} 筆</span>
        </div>
        {account.canWrite && <AdminButton onClick={() => { setEditing(null); setShowForm(true); }}>登記收退款</AdminButton>}
      </div>
      {!account.canWrite && <p className="adminOrderFinanceNotice">此顧客沿用原營業日帳務；分項帳款在新開啟的分項接待營業日使用。</p>}
      {showForm && account.canWrite && <FinanceForm key={`${sessionId}-${editing?.id ?? "new"}`} account={account} periods={periods} orders={orders} record={editing}
        onSaved={() => { setShowForm(false); setRevision(n => n + 1); }} onClose={() => setShowForm(false)} />}
      <div className="adminOrderFinanceRecords">
        {!account.records.length && <p className="adminOrderFinanceEmpty">尚無額外帳款紀錄。</p>}
        {account.records.map(record => <article key={record.id} className="adminOrderFinanceRecord adminOrderCashRecord">
          {/* Focusable scrolling preserves long reasons and timestamps in a single row. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="adminOrderCashRecordContent" role="region" aria-label={`${kindLabels[record.kind]}詳細資訊`} tabIndex={0}>
            <strong>{kindLabels[record.kind]}</strong>
            <span className="adminOrderFinanceTag">{record.allocationStatus === "confirmed" ? "已確認" : "待確認"}</span>
            <span>{record.reason}</span>
            <time dateTime={record.occurredAt}>{new Date(record.occurredAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}</time>
            {record.cashPeriodId === null && (record.kind === "cash_receipt" || record.kind === "cash_refund") && <span>收退款營業日待歸屬</span>}
          </div>
          <b>{money(record.amount)}</b>
          {account.canWrite && <AdminButton variant="secondary" onClick={() => { setEditing(record); setShowForm(true); }}>更正／確認</AdminButton>}
        </article>)}
      </div>
    </>}
  </section>;
}

function FinanceForm({ account, periods, orders, record, onSaved, onClose }: {
  account: FinanceAccount; periods: FinancePeriodOption[]; orders: FinanceOrderOption[]; record: FinanceRecord | null; onSaved: () => void; onClose: () => void;
}) {
  const [kind, setKind] = useState(record?.kind ?? "cash_receipt");
  const [amount, setAmount] = useState(record?.amount ?? 0);
  const [source, setSource] = useState(record?.sourceKind ?? "unallocated");
  const [orderId, setOrderId] = useState(record?.orderId ?? "");
  const [itemId, setItemId] = useState(record?.orderItemId ?? "");
  const [cashPeriod, setCashPeriod] = useState(record?.cashPeriodId ?? "");
  const [occurredAt, setOccurredAt] = useState(() => taiwanInput(record?.occurredAt ?? new Date().toISOString()));
  const [pending, setPending] = useState(record ? record.allocationStatus === "pending" : true);
  const [reason, setReason] = useState(record?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<FinanceSaveRequest | null>(null);
  const isCash = kind === "cash_receipt" || kind === "cash_refund";
  const save = async () => {
    const body: FinanceSaveRequest = retry ?? {
      operationId: crypto.randomUUID(), expectedVersion: account.version, kind, amount, sourceKind: source,
      sourcePeriodId: account.sourcePeriodId, orderId: source === "order" || source === "item" ? orderId : null,
      orderItemId: source === "item" ? itemId : null, cashPeriodId: isCash ? cashPeriod || null : null,
      occurredAt: `${occurredAt}:00+08:00`, allocationStatus: pending || source === "unallocated" ? "pending" : "confirmed",
      holdScope: pending || source === "unallocated" ? "session" : "none", reason, reversesRecordId: record?.reversesRecordId ?? null,
    };
    setBusy(true); setRetry(body); setError("");
    try {
      const prior = await financeApi.operation(account.sessionId, body.operationId);
      if (!prior) await financeApi.save(account.sessionId, record?.id ?? null, body);
      setRetry(null); onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) setRetry(null);
    } finally { setBusy(false); }
  };
  return <form className="adminOrderFinanceForm" onSubmit={e => { e.preventDefault(); void save(); }}>
    <h4>{record ? "更正／確認既有紀錄" : "登記現場費用"}</h4>
    {record && <p>更正保留原始紀錄及修改歷程；若現場真的再次收款或退款，請另外新增實收／實退。</p>}
    <fieldset disabled={busy || !!retry}>
      <label>類別<select value={kind} disabled={!!record} onChange={e => setKind(financeKind(e.target.value))}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>金額<input type="number" min={record ? 0 : 1} max={1000000000000} step="1" required value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
      <label>費用歸屬<select value={source} onChange={e => setSource(financeSource(e.target.value))}><option value="unallocated">稍後確認</option><option value="admission">入場費</option><option value="order">訂單</option><option value="item">訂單項目</option></select></label>
      {(source === "order" || source === "item") && <label>訂單<select required value={orderId} onChange={e => { setOrderId(e.target.value); setItemId(""); }}><option value="">請選擇</option>{orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}</select></label>}
      {source === "item" && <label>項目<select required value={itemId} onChange={e => setItemId(e.target.value)}><option value="">請選擇</option>{orders.find(o => o.id === orderId)?.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
      {isCash && <label>收退款營業日<select value={cashPeriod} onChange={e => setCashPeriod(e.target.value)}><option value="">先記款項，稍後歸屬</option>{periods.map(p => <option key={p.id} value={p.id}>{p.businessDate}</option>)}</select></label>}
      <label>實際發生時間（台灣時間）<input type="datetime-local" required value={occurredAt} onChange={e => setOccurredAt(e.target.value)} /></label>
      <label>原因<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <label className="adminOrderFinanceCheckbox"><input type="checkbox" checked={pending || source === "unallocated"} disabled={source === "unallocated"} onChange={e => setPending(e.target.checked)} />留待後續確認，分潤先保留</label>
    </fieldset>
    {error && <p className="adminOrderFinanceNotice isError" role="alert">{error}</p>}
    <div className="adminOrderFinanceActions">
      <AdminButton type="submit" disabled={busy}>{retry ? "查回／重試同一筆操作" : "儲存紀錄"}</AdminButton>
      <AdminButton variant="ghost" disabled={busy || !!retry} onClick={onClose}>返回</AdminButton>
    </div>
  </form>;
}
