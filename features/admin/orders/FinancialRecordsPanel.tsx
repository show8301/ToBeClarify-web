"use client";

import { useEffect, useState } from "react";
import { FINANCE_UPDATED, isFinanceUpdateFor } from "./finance-events";
import { financeApi, financeKind, financeSource } from "./finance-api";
import type { FinanceAccount, FinanceOrderOption, FinancePeriodOption, FinanceRecord, FinanceSaveRequest, FinanceTipDistributionMode } from "./finance-types";
import { AdmissionAndCasesPanel } from "./AdmissionAndCasesPanel";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";

const kindLabels = { charge_add: "增加應收", charge_reduce: "減少應收", cash_receipt: "實際收款", cash_refund: "實際退款", tip_supplement: "舊版小費分配" };
const tipDistributionLabels: Record<FinanceTipDistributionMode, string> = { public: "公共小費（按工時分配）", equal: "舊版人頭均分", designated: "指定店員", custom: "自訂比例" };
function balanceDelta(kind: string, amount: number): number {
  return kind === "charge_add" || kind === "cash_refund" ? amount : kind === "charge_reduce" || kind === "cash_receipt" ? -amount : 0;
}
function financeImpact(kind: string, amount: number, voided = false): string {
  if (voided) return `已作廢 ${money(amount)}（不計入）`;
  const direction = amount >= 0 ? "+" : "−";
  const opposite = amount >= 0 ? "−" : "+";
  const value = money(Math.abs(amount));
  if (kind === "charge_add") return `應收 ${direction}${value}`;
  if (kind === "charge_reduce") return `應收 ${opposite}${value}`;
  if (kind === "cash_receipt") return `實收 ${direction}${value}`;
  if (kind === "cash_refund") return `退款 ${direction}${value}／淨收 ${opposite}${value}`;
  return `舊版薪資分配 ${value}（應收／實收不變）`;
}
const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;
const balanceText = (balance: number) => balance < 0 ? `待退款 ${money(-balance)}` : `尚欠 ${money(balance)}`;
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
  const [initialKind, setInitialKind] = useState<"cash_receipt" | "cash_refund" | "charge_add">("cash_receipt");
  const [voidingRecord, setVoidingRecord] = useState<FinanceRecord | null>(null);
  useEffect(() => {
    const handler = (event: Event) => { if (isFinanceUpdateFor(event, sessionId)) setRevision(n => n + 1); };
    window.addEventListener(FINANCE_UPDATED, handler);
    return () => window.removeEventListener(FINANCE_UPDATED, handler);
  }, [sessionId]);
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
      <div className="adminOrderHeadingWithHelp"><h3>現場帳款</h3><AdminHelp title="現場帳款說明">訂單與應收調整決定顧客應付多少；實收與退款記錄實際金流。小費請從補登已成交訂單建立，分配在原訂單更正。取消餐點已減少應收，請勿再次折讓。</AdminHelp></div>
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
          <span className="adminOrderFinanceRecordCount">{account.records.filter(x => x.kind !== "tip_supplement").length} 筆</span>
        </div>
        {account.canWrite && <div className="adminOrderFinanceRecordActions">
          <AdminButton variant="secondary" onClick={() => { setEditing(null); setInitialKind("charge_add"); setShowForm(true); }}>調整應收</AdminButton>
          <AdminButton variant="secondary" onClick={() => { setEditing(null); setInitialKind("cash_refund"); setShowForm(true); }}>登記退款</AdminButton>
          <AdminButton onClick={() => { setEditing(null); setInitialKind("cash_receipt"); setShowForm(true); }}>登記收款</AdminButton>
        </div>}
      </div>
      {!account.canWrite && <p className="adminOrderFinanceNotice">此顧客沿用原營業日帳務；分項帳款在新開啟的分項接待營業日使用。</p>}
      {showForm && account.canWrite && <FinanceForm key={`${sessionId}-${editing?.id ?? `new-${initialKind}`}`} account={account} periods={periods} orders={orders} record={editing} initialKind={initialKind}
        onSaved={() => { setShowForm(false); setRevision(n => n + 1); }} onClose={() => setShowForm(false)} />}
      <p>應收 {money(account.orderReceivable)}（訂單）＋{money(account.chargeAdditions)}（加收）−{money(account.chargeReductions)}（折讓）＝{money(account.receivable)}；尚欠＝應收−實收＋退款。</p>
      {account.records.some(x => x.kind === "tip_supplement" && !x.isVoided) && <p className="adminOrderFinanceNotice isError" role="alert">存在舊版小費分配：只影響薪資，不代表已收款。請核對原訂單，重複分配可填原因作廢；請勿未核對就再新增訂單。</p>}
      <div className="adminOrderFinanceRecords">
        {!account.records.length && <p className="adminOrderFinanceEmpty">尚無額外帳款紀錄。</p>}
        {[false, ...(account.records.some(x => x.kind === "tip_supplement") ? [true] : [])].map(legacy => <details key={String(legacy)} open={!legacy}>
          <summary>{legacy ? "舊版小費分配（不影響應收／實收，核對後可作廢）" : "應收調整與收退款明細"}</summary>
          {account.records.filter(record => (record.kind === "tip_supplement") === legacy).map(record => {
          const sourceOrder = orders.find(order => order.id === record.orderId);
          const sourceItem = sourceOrder?.items.find(item => item.id === record.orderItemId);
          const linkedCashRecord = account.records.find(item => item.id === record.linkedCashRecordId);
          return <article key={record.id} className={`adminOrderFinanceRecord adminOrderCashRecord${record.isVoided ? " isVoided" : ""}`}>
          {/* Focusable scrolling preserves long reasons and timestamps in a single row. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="adminOrderCashRecordContent" role="region" aria-label={`${kindLabels[record.kind]}詳細資訊`} tabIndex={0}>
            <strong>{kindLabels[record.kind]}</strong>
            <span className="adminOrderFinanceTag">{record.isVoided ? "已作廢" : record.allocationStatus === "confirmed" ? "已確認" : "待確認"}</span>
            {sourceOrder && <a href={`#admin-order-${encodeURIComponent(sourceOrder.id)}`}>來源訂單 {sourceOrder.orderNumber}{sourceItem ? ` · ${sourceItem.name}` : ""}</a>}
            <span>{record.reason}</span>
            <time dateTime={record.occurredAt}>{new Date(record.occurredAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}</time>
            {record.cashPeriodId === null && (record.kind === "cash_receipt" || record.kind === "cash_refund") && <span>收退款營業日待歸屬</span>}
            {record.kind === "tip_supplement" && <span>{tipDistributionLabels[record.tipDistributionMode ?? "equal"]}：{record.tipAllocations.map(allocation => `${allocation.staffName} ${money(allocation.amount)}${allocation.percentage === null ? "" : `（${allocation.percentage}%）`}`).join("、")}</span>}
            {record.kind === "tip_supplement" && linkedCashRecord && <span>關聯實收 {money(linkedCashRecord.amount)}{linkedCashRecord.isVoided ? "（該收款已作廢）" : ""}</span>}
            {record.isVoided && <span>作廢原因：{record.voidReason || "未提供"}{record.voidedByDisplayName ? ` · ${record.voidedByDisplayName}` : ""}{record.voidedAt ? ` · ${new Date(record.voidedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}` : ""}</span>}
          </div>
          <b>{financeImpact(record.kind, record.amount, record.isVoided)}</b>
          {account.canWrite && !record.isVoided && <div className="adminOrderFinanceRecordActions">
            {record.kind !== "tip_supplement" && <AdminButton variant="secondary" onClick={() => { setEditing(record); setShowForm(true); }}>更正／確認</AdminButton>}
            {(record.kind === "cash_receipt" || record.kind === "cash_refund" || record.kind === "tip_supplement") && <AdminButton variant="ghost" onClick={() => setVoidingRecord(record)}>作廢紀錄</AdminButton>}
          </div>}
          {voidingRecord?.id === record.id && <FinanceVoidControl account={account} record={record}
            onSaved={() => { setVoidingRecord(null); setRevision(value => value + 1); }} onCancel={() => setVoidingRecord(null)} />}
        </article>;
        })}</details>)}
      </div>
    </>}
  </section>;
}

function FinanceForm({ account, periods, orders, record, initialKind, onSaved, onClose }: {
  account: FinanceAccount; periods: FinancePeriodOption[]; orders: FinanceOrderOption[];
  record: FinanceRecord | null; initialKind: "cash_receipt" | "cash_refund" | "charge_add"; onSaved: () => void; onClose: () => void;
}) {
  const [kind, setKind] = useState(record?.kind ?? initialKind);
  const [amount, setAmount] = useState(record?.amount ?? 0);
  const [source, setSource] = useState(record?.sourceKind ?? "order");
  const [orderId, setOrderId] = useState(record?.orderId ?? "");
  const [itemId, setItemId] = useState(record?.orderItemId ?? "");
  const [cashPeriod, setCashPeriod] = useState(record?.cashPeriodId ?? "");
  const [occurredAt, setOccurredAt] = useState(() => taiwanInput(record?.occurredAt ?? new Date().toISOString()));
  const [pending, setPending] = useState(record ? record.allocationStatus === "pending" : false);
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
      holdScope: pending || source === "unallocated" ? "session" : "none",
      reason, reversesRecordId: record?.reversesRecordId ?? null,
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
    <h4>{record ? "更正／確認既有紀錄" : isCash ? "登記收退款" : "調整應收"}</h4>
    {record && <p>更正保留原始紀錄及修改歷程；若現場真的再次收款或退款，請另外新增實收／實退。</p>}
    <fieldset disabled={busy || !!retry}>
      <label>類別<select value={kind} disabled={!!record} onChange={e => setKind(financeKind(e.target.value))}>
        {Object.entries(kindLabels).filter(([value]) => record ? value === record.kind : initialKind === "charge_add" ? value === "charge_add" || value === "charge_reduce" : value === "cash_receipt" || value === "cash_refund").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>金額<input type="number" min={record && (kind === "charge_add" || kind === "charge_reduce") ? 0 : 1} max={1000000000000} step="1" required value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
      <label>費用歸屬<select value={source} onChange={e => setSource(financeSource(e.target.value))}>
        <option value="unallocated">稍後確認</option><option value="admission">入場費</option><option value="order">訂單</option><option value="item">訂單項目</option>
      </select></label>
      {(source === "order" || source === "item") && <label>訂單<select required value={orderId} onChange={e => { setOrderId(e.target.value); setItemId(""); }}><option value="">請選擇</option>{orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}</select></label>}
      {source === "item" && <label>項目<select required value={itemId} onChange={e => setItemId(e.target.value)}><option value="">請選擇</option>{orders.find(o => o.id === orderId)?.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
      {isCash && <label>收退款營業日<select value={cashPeriod} onChange={e => setCashPeriod(e.target.value)}><option value="">先記款項，稍後歸屬</option>{periods.map(p => <option key={p.id} value={p.id}>{p.businessDate}</option>)}</select></label>}
      <label>實際發生時間（台灣時間）<input type="datetime-local" required value={occurredAt} onChange={e => setOccurredAt(e.target.value)} /></label>
      <label>原因<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {<label className="adminOrderFinanceCheckbox"><input type="checkbox" checked={pending || source === "unallocated"} disabled={source === "unallocated"} onChange={e => setPending(e.target.checked)} />留待後續確認，分潤先保留</label>}
    </fieldset>
    <p role="status">本次{financeImpact(kind, amount - (record?.amount ?? 0))}；{balanceText(account.balance)} → {balanceText(account.balance + balanceDelta(kind, amount - (record?.amount ?? 0)))}。{kind === "charge_reduce" ? "折讓不會實際退款。" : kind === "cash_refund" ? "退款不會減少應收；取消或折讓請核對原訂單。" : ""}</p>
    {error && <p className="adminOrderFinanceNotice isError" role="alert">{error}</p>}
    <div className="adminOrderFinanceActions">
      <AdminButton type="submit" disabled={busy}>{retry ? "查回／重試同一筆操作" : "儲存紀錄"}</AdminButton>
      <AdminButton variant="ghost" disabled={busy || !!retry} onClick={onClose}>返回</AdminButton>
    </div>
  </form>;
}

function FinanceVoidControl({ account, record, onSaved, onCancel }: {
  account: FinanceAccount; record: FinanceRecord; onSaved: () => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<{ operationId: string; expectedAccountVersion: number; expectedRecordVersion: number; reason: string } | null>(null);
  const save = async () => {
    const body = retry ?? { operationId: crypto.randomUUID(), expectedAccountVersion: account.version,
      expectedRecordVersion: record.version, reason };
    if (!body.reason.trim()) { setError("請填寫作廢原因。"); return; }
    setBusy(true); setRetry(body); setError("");
    try {
      const prior = await financeApi.operation(account.sessionId, body.operationId);
      if (!prior) await financeApi.voidRecord(account.sessionId, record.id, body);
      setRetry(null); onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "作廢失敗");
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) setRetry(null);
    } finally { setBusy(false); }
  };
  return <div className="adminOrderFinanceVoidForm" role="group" aria-label="作廢收退款紀錄">
    <p>作廢只撤回登記，不代表現場發生退款，原紀錄與原因仍保留。{record.kind === "tip_supplement" ? "舊版分配將不再計入下次結算，應收與實收不變；請先核對訂單內是否已有正確分配。" : `本次${financeImpact(record.kind, -record.amount)}；${balanceText(account.balance)} → ${balanceText(account.balance - balanceDelta(record.kind, record.amount))}。`}已正式結算需由經理重新結算。</p>
    <label>作廢原因<input required maxLength={500} value={reason} disabled={busy || !!retry} onChange={e => setReason(e.target.value)} /></label>
    {error && <p className="adminOrderFinanceNotice isError" role="alert">{error}</p>}
    <div className="adminOrderFinanceActions">
      <AdminButton type="button" disabled={busy} onClick={() => void save()}>{retry ? "查回／重試作廢" : `確認作廢 ${money(record.amount)}`}</AdminButton>
      <AdminButton type="button" variant="ghost" disabled={busy || !!retry} onClick={onCancel}>取消</AdminButton>
    </div>
  </div>;
}
