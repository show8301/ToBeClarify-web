"use client";

import { useEffect, useState } from "react";
import { financeApi, financeKind, financeSource } from "./finance-api";
import type { FinanceAccount, FinanceOrderOption, FinancePeriodOption, FinanceRecord, FinanceSaveRequest, FinanceTipAllocationInput, FinanceTipDistributionMode, FinanceTipStaffOption } from "./finance-types";
import { AdmissionAndCasesPanel } from "./AdmissionAndCasesPanel";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";

const kindLabels = { charge_add: "加收應付", charge_reduce: "折讓應付", cash_receipt: "實際收款", cash_refund: "實際退款", tip_supplement: "補登小費" };
const tipDistributionLabels: Record<FinanceTipDistributionMode, string> = { equal: "上班員工均分", designated: "指定店員", custom: "自訂比例" };
const payrollRoleLabels: Record<string, string> = { designated: "指名", service: "服務員", manager: "經理", backstage: "幕後" };
const tipRoles = (roles: string[]) => roles.map(role => payrollRoleLabels[role] ?? role).join("／");
const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;
function taiwanInput(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + 8 * 3600000).toISOString().slice(0, 16) : "";
}

export function FinancialRecordsPanel({ sessionId, refreshKey }: { sessionId: string; refreshKey?: string }) {
  const [account, setAccount] = useState<FinanceAccount | null>(null);
  const [periods, setPeriods] = useState<FinancePeriodOption[]>([]);
  const [orders, setOrders] = useState<FinanceOrderOption[]>([]);
  const [tipStaff, setTipStaff] = useState<FinanceTipStaffOption[]>([]);
  const [admission, setAdmission] = useState<import("./finance-types").AdmissionEntry | null>(null);
  const [cases, setCases] = useState<import("./finance-types").FinanceCase[]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<FinanceRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [initialKind, setInitialKind] = useState<"cash_receipt" | "tip_supplement">("cash_receipt");
  const [voidingRecord, setVoidingRecord] = useState<FinanceRecord | null>(null);
  const requestKey = `${sessionId}:${revision}:${refreshKey ?? ""}`;
  const [settledRequest, setSettledRequest] = useState("");
  const loading = settledRequest !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([financeApi.account(sessionId, controller.signal), financeApi.periods(sessionId, controller.signal), financeApi.orders(sessionId, controller.signal), financeApi.tipStaff(sessionId, controller.signal), financeApi.admission(sessionId, controller.signal), financeApi.cases(sessionId, false, controller.signal)])
      .then(([a, p, o, staffOptions, admissionEntry, financeCases]) => { setAccount(a); setPeriods(p); setOrders(o); setTipStaff(staffOptions); setAdmission(admissionEntry); setCases(financeCases); setError(""); })
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
        {account.canWrite && <div className="adminOrderFinanceRecordActions">
          <AdminButton variant="secondary" onClick={() => { setEditing(null); setInitialKind("tip_supplement"); setShowForm(true); }}>補登小費</AdminButton>
          <AdminButton onClick={() => { setEditing(null); setInitialKind("cash_receipt"); setShowForm(true); }}>登記收退款</AdminButton>
        </div>}
      </div>
      {!account.canWrite && <p className="adminOrderFinanceNotice">此顧客沿用原營業日帳務；分項帳款在新開啟的分項接待營業日使用。</p>}
      {showForm && account.canWrite && <FinanceForm key={`${sessionId}-${editing?.id ?? `new-${initialKind}`}`} account={account} periods={periods} orders={orders} tipStaff={tipStaff} record={editing} initialKind={initialKind}
        onSaved={() => { setShowForm(false); setRevision(n => n + 1); }} onClose={() => setShowForm(false)} />}
      <div className="adminOrderFinanceRecords">
        {!account.records.length && <p className="adminOrderFinanceEmpty">尚無額外帳款紀錄。</p>}
        {account.records.map(record => {
          const sourceOrder = orders.find(order => order.id === record.orderId);
          const sourceItem = sourceOrder?.items.find(item => item.id === record.orderItemId);
          const linkedCashRecord = account.records.find(item => item.id === record.linkedCashRecordId);
          return <article key={record.id} className={`adminOrderFinanceRecord adminOrderCashRecord${record.isVoided ? " isVoided" : ""}`}>
          {/* Focusable scrolling preserves long reasons and timestamps in a single row. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="adminOrderCashRecordContent" role="region" aria-label={`${kindLabels[record.kind]}詳細資訊`} tabIndex={0}>
            <strong>{kindLabels[record.kind]}</strong>
            <span className="adminOrderFinanceTag">{record.isVoided ? "已作廢" : record.allocationStatus === "confirmed" ? "已確認" : "待確認"}</span>
            {sourceOrder && <span>來源訂單 {sourceOrder.orderNumber}{sourceItem ? ` · ${sourceItem.name}` : ""}</span>}
            <span>{record.reason}</span>
            <time dateTime={record.occurredAt}>{new Date(record.occurredAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}</time>
            {record.cashPeriodId === null && (record.kind === "cash_receipt" || record.kind === "cash_refund") && <span>收退款營業日待歸屬</span>}
            {record.kind === "tip_supplement" && <span>{tipDistributionLabels[record.tipDistributionMode ?? "equal"]}：{record.tipAllocations.map(allocation => `${allocation.staffName} ${money(allocation.amount)}${allocation.percentage === null ? "" : `（${allocation.percentage}%）`}`).join("、")}</span>}
            {record.kind === "tip_supplement" && linkedCashRecord && <span>關聯實收 {money(linkedCashRecord.amount)}{linkedCashRecord.isVoided ? "（該收款已作廢）" : ""}</span>}
            {record.isVoided && <span>作廢原因：{record.voidReason || "未提供"}{record.voidedByDisplayName ? ` · ${record.voidedByDisplayName}` : ""}{record.voidedAt ? ` · ${new Date(record.voidedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}` : ""}</span>}
          </div>
          <b>{money(record.amount)}</b>
          {account.canWrite && !record.isVoided && <div className="adminOrderFinanceRecordActions">
            <AdminButton variant="secondary" onClick={() => { setEditing(record); setShowForm(true); }}>更正／確認</AdminButton>
            {(record.kind === "cash_receipt" || record.kind === "cash_refund") && <AdminButton variant="ghost" onClick={() => setVoidingRecord(record)}>作廢紀錄</AdminButton>}
          </div>}
          {voidingRecord?.id === record.id && <FinanceVoidControl account={account} record={record}
            onSaved={() => { setVoidingRecord(null); setRevision(value => value + 1); }} onCancel={() => setVoidingRecord(null)} />}
        </article>;
        })}
      </div>
    </>}
  </section>;
}

function FinanceForm({ account, periods, orders, tipStaff, record, initialKind, onSaved, onClose }: {
  account: FinanceAccount; periods: FinancePeriodOption[]; orders: FinanceOrderOption[]; tipStaff: FinanceTipStaffOption[];
  record: FinanceRecord | null; initialKind: "cash_receipt" | "tip_supplement"; onSaved: () => void; onClose: () => void;
}) {
  const [kind, setKind] = useState(record?.kind ?? initialKind);
  const [amount, setAmount] = useState(record?.amount ?? 0);
  const [source, setSource] = useState(record?.sourceKind ?? (initialKind === "tip_supplement" ? "order" : "unallocated"));
  const [orderId, setOrderId] = useState(record?.orderId ?? "");
  const [itemId, setItemId] = useState(record?.orderItemId ?? "");
  const [cashPeriod, setCashPeriod] = useState(record?.cashPeriodId ?? "");
  const [linkedCashRecordId, setLinkedCashRecordId] = useState(record?.linkedCashRecordId ?? "");
  const [occurredAt, setOccurredAt] = useState(() => taiwanInput(record?.occurredAt ?? new Date().toISOString()));
  const [pending, setPending] = useState(record ? record.allocationStatus === "pending" : true);
  const [reason, setReason] = useState(record?.reason ?? "");
  const [tipMode, setTipMode] = useState<FinanceTipDistributionMode>(record?.tipDistributionMode ?? "equal");
  const [selectedTipStaff, setSelectedTipStaff] = useState<string[]>(record?.tipAllocations.map(item => item.staffId) ?? []);
  const [tipPercentages, setTipPercentages] = useState<Record<string, string>>(() => Object.fromEntries(
    (record?.tipAllocations ?? []).filter(item => item.percentage !== null).map(item => [item.staffId, String(item.percentage)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<FinanceSaveRequest | null>(null);
  const isCash = kind === "cash_receipt" || kind === "cash_refund";
  const isTip = kind === "tip_supplement";
  const tipAllocationInputs: FinanceTipAllocationInput[] = tipMode === "designated"
    ? selectedTipStaff.slice(0, 1).map(staffId => ({ staffId, percentage: null }))
    : tipMode === "equal"
      ? tipStaff.map(staff => ({ staffId: staff.staffId, percentage: null }))
      : selectedTipStaff.map(staffId => ({ staffId, percentage: Number(tipPercentages[staffId] ?? 0) }));
  const toggleTipStaff = (staffId: string, checked: boolean) => setSelectedTipStaff(current => {
    if (checked) return current.includes(staffId) ? current : [...current, staffId];
    return current.filter(id => id !== staffId);
  });
  const save = async () => {
    if (isTip && tipAllocationInputs.length === 0) {
      setError("請先選擇本時段有出勤計薪紀錄的店員。");
      return;
    }
    if (isTip && tipMode === "custom" && Math.round(tipAllocationInputs.reduce((total, item) => total + (item.percentage ?? 0), 0) * 10000) !== 1000000) {
      setError("自訂比例合計須為 100%。");
      return;
    }
    const body: FinanceSaveRequest = retry ?? {
      operationId: crypto.randomUUID(), expectedVersion: account.version, kind, amount, sourceKind: source,
      sourcePeriodId: account.sourcePeriodId, orderId: source === "order" || source === "item" ? orderId : null,
      orderItemId: source === "item" ? itemId : null, cashPeriodId: isCash ? cashPeriod || null : null,
      occurredAt: `${occurredAt}:00+08:00`, allocationStatus: isTip ? "confirmed" : pending || source === "unallocated" ? "pending" : "confirmed",
      holdScope: isTip ? "none" : pending || source === "unallocated" ? "session" : "none",
      reason, reversesRecordId: record?.reversesRecordId ?? null,
      tipDistributionMode: isTip ? tipMode : null, tipAllocations: isTip ? tipAllocationInputs : [],
      linkedCashRecordId: isTip ? linkedCashRecordId || null : null,
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
    <h4>{record ? "更正／確認既有紀錄" : isTip ? "補登小費" : "登記現場費用"}</h4>
    {record && <p>更正保留原始紀錄及修改歷程；若現場真的再次收款或退款，請另外新增實收／實退。</p>}
    <fieldset disabled={busy || !!retry}>
      <label>類別<select value={kind} disabled={!!record} onChange={e => {
        const nextKind = financeKind(e.target.value);
        setKind(nextKind);
        if (nextKind === "tip_supplement" && source !== "order" && source !== "item") setSource("order");
      }}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>金額<input type="number" min={record && (kind === "charge_add" || kind === "charge_reduce") ? 0 : 1} max={1000000000000} step="1" required value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
      <label>費用歸屬<select value={source} disabled={isTip} onChange={e => setSource(financeSource(e.target.value))}>
        {isTip ? <><option value="order">訂單</option><option value="item">訂單項目</option></> : <><option value="unallocated">稍後確認</option><option value="admission">入場費</option><option value="order">訂單</option><option value="item">訂單項目</option></>}
      </select></label>
      {(source === "order" || source === "item") && <label>訂單<select required value={orderId} onChange={e => { setOrderId(e.target.value); setItemId(""); }}><option value="">請選擇</option>{orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}</select></label>}
      {source === "item" && <label>項目<select required value={itemId} onChange={e => setItemId(e.target.value)}><option value="">請選擇</option>{orders.find(o => o.id === orderId)?.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
      {isCash && <label>收退款營業日<select value={cashPeriod} onChange={e => setCashPeriod(e.target.value)}><option value="">先記款項，稍後歸屬</option>{periods.map(p => <option key={p.id} value={p.id}>{p.businessDate}</option>)}</select></label>}
      {isTip && <>
        <label>分配方式<select value={tipMode} onChange={e => setTipMode(e.target.value as FinanceTipDistributionMode)}>
          <option value="equal">上班員工均分</option><option value="designated">指定一位店員</option><option value="custom">自訂比例</option>
        </select></label>
        {tipMode === "designated" ? <label>店員<select required value={selectedTipStaff[0] ?? ""} onChange={e => setSelectedTipStaff(e.target.value ? [e.target.value] : [])}>
          <option value="">請選擇</option>{tipStaff.map(staff => <option key={staff.staffId} value={staff.staffId}>{staff.displayName} · {tipRoles(staff.roles)}</option>)}
        </select></label> : tipMode === "equal" ? <div className="adminOrderFinanceTipStaff"><strong>均分對象</strong>
          {tipStaff.length === 0
            ? <p className="adminOrderFinanceNotice">本時段尚無已記錄出勤時間的計薪人員，請先完成結算出勤輸入。</p>
            : <p>{tipStaff.map(staff => `${staff.displayName}（${tipRoles(staff.roles)}）`).join("、")}</p>}
        </div> : <fieldset className="adminOrderFinanceTipStaff"><legend>選擇分配對象與比例</legend>
          {tipStaff.length === 0 && <p className="adminOrderFinanceNotice">本時段尚無已記錄出勤時間的計薪人員，請先完成結算出勤輸入。</p>}
          {tipStaff.map(staff => <label key={staff.staffId} className="adminOrderFinanceTipStaffChoice">
            <span><input type="checkbox" checked={selectedTipStaff.includes(staff.staffId)} onChange={e => toggleTipStaff(staff.staffId, e.target.checked)} />{staff.displayName} · {tipRoles(staff.roles)}</span>
            {tipMode === "custom" && selectedTipStaff.includes(staff.staffId) && <input aria-label={`${staff.displayName}小費比例`} type="number" min="0.01" max="100" step="0.01" required value={tipPercentages[staff.staffId] ?? ""} onChange={e => setTipPercentages(current => ({ ...current, [staff.staffId]: e.target.value }))} />}
          </label>)}
        </fieldset>}
        <label>關聯實收紀錄（如已登記）<select value={linkedCashRecordId} onChange={e => setLinkedCashRecordId(e.target.value)}>
          <option value="">未關聯</option>{account.records.filter(item => item.kind === "cash_receipt" && !item.isVoided).map(item => <option key={item.id} value={item.id}>{money(item.amount)} · {new Date(item.occurredAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}</option>)}
        </select></label>
        <p className="adminOrderFinanceNotice">補登小費只計入店員薪資，不會重複增加應收或實收。若已含在實收，請關聯該收款；保存後請重新計算本時段結算。</p>
      </>}
      <label>實際發生時間（台灣時間）<input type="datetime-local" required value={occurredAt} onChange={e => setOccurredAt(e.target.value)} /></label>
      <label>原因<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {!isTip && <label className="adminOrderFinanceCheckbox"><input type="checkbox" checked={pending || source === "unallocated"} disabled={source === "unallocated"} onChange={e => setPending(e.target.checked)} />留待後續確認，分潤先保留</label>}
    </fieldset>
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
    <p>作廢後會從帳款與結算排除，但原紀錄仍保留。若現場款項仍需收退，請另登正確的收退款。</p>
    <label>作廢原因<input required maxLength={500} value={reason} disabled={busy || !!retry} onChange={e => setReason(e.target.value)} /></label>
    {error && <p className="adminOrderFinanceNotice isError" role="alert">{error}</p>}
    <div className="adminOrderFinanceActions">
      <AdminButton type="button" disabled={busy} onClick={() => void save()}>{retry ? "查回／重試作廢" : `確認作廢 ${money(record.amount)}`}</AdminButton>
      <AdminButton type="button" variant="ghost" disabled={busy || !!retry} onClick={onCancel}>取消</AdminButton>
    </div>
  </div>;
}
