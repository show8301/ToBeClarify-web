"use client";

import { useEffect, useRef, useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminButton";
import { ApiError } from "@/features/admin/api/client.js";
import { financeApi } from "./finance-api";
import type { FinanceAccount } from "./finance-types";
import { backfillApi } from "./backfill-api";
import type { BackfillChoice, BackfillLine, BackfillQuote, BackfillRequest } from "./backfill-api";

type Props = { sessionId: string; businessDate: string; onSaved: () => Promise<void>; onClose: () => void };
const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;
const iso = (value: string) => {
  const time = new Date(value);
  if (!value || !Number.isFinite(time.getTime())) throw new Error("請填寫完整的實際發生與服務時間。");
  return time.toISOString();
};
function localTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  return parts.replace(" ", "T");
}
// datetime-local is a wall clock in Taiwan, even if the browser uses another time zone.
const taiwanIso = (value: string) => iso(value ? `${value}:00+08:00` : "");

export function AdminOrderBackfillPanel({ sessionId, businessDate, onSaved, onClose }: Props) {
  const [catalog, setCatalog] = useState<{ choices: BackfillChoice[]; segmentMinutes: number } | null>(null);
  const [account, setAccount] = useState<FinanceAccount | null>(null);
  const [lines, setLines] = useState<BackfillLine[]>([]);
  const [choiceKey, setChoiceKey] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [reason, setReason] = useState("");
  const [cashId, setCashId] = useState("");
  const [quote, setQuote] = useState<BackfillQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [savedNumber, setSavedNumber] = useState("");
  const operation = useRef("");
  const quotedRequest = useRef<BackfillRequest | null>(null);
  const submittedRequest = useRef<(BackfillRequest & { quoteToken: string }) | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([backfillApi.catalog(businessDate, controller.signal), financeApi.account(sessionId, controller.signal)])
      .then(([menu, finance]) => { if (!controller.signal.aborted) { setCatalog(menu); setAccount(finance); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "資料載入失敗。"); });
    return () => controller.abort();
  }, [sessionId, businessDate]);

  function changed() { setQuote(null); quotedRequest.current = null; operation.current = ""; setError(""); }
  function updateLine(id: string, patch: Partial<BackfillLine>) {
    setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line)); changed();
  }
  function addLine() {
    const choice = catalog?.choices.find(item => item.key === choiceKey);
    if (!choice) return;
    if (!occurredAt) { setError("請先填寫本單實際發生時間。"); return; }
    const start = new Date(taiwanIso(occurredAt));
    const duration = choice.duration || catalog?.segmentMinutes || 20;
    setLines(current => [...current, { id: crypto.randomUUID(), choice,
      quantity: choice.kind === "nomination" ? Math.max(1, Math.ceil(duration / (catalog?.segmentMinutes || 20))) : 1,
      unitPrice: choice.unitPrice, basePrice: choice.basePrice || 0, startsAt: occurredAt,
      endsAt: localTime(new Date(start.getTime() + duration * 60000)), staffPercentage: choice.staffId ? 100 : 0 }]);
    changed();
  }
  async function preview() {
    if (!account || !lines.length || !reason.trim()) { setError("請加入品項並填寫補登原因。"); return; }
    setBusy(true); setError("");
    try {
      const cash = account.records.find(record => record.id === cashId);
      const body: BackfillRequest = {
        backfill: { operationId: operation.current ||= crypto.randomUUID(), occurredAt: taiwanIso(occurredAt),
          reason: reason.trim(), linkedCashRecordId: cashId || null, expectedFinanceVersion: account.version,
          expectedCashRecordVersion: cash?.version ?? null },
        meals: lines.filter(x => x.choice.kind === "item" || x.choice.kind === "set").map(x => ({
          kind: x.choice.kind, referenceId: x.choice.referenceId, quantity: x.quantity, unitPrice: x.unitPrice,
          recipientStaffId: x.choice.isChampagneTower ? x.recipientStaffId || null : null })),
        nominations: lines.filter(x => x.choice.kind === "nomination").map(x => ({ staffId: x.choice.staffId!,
          mode: x.choice.serviceId ? "service" : "companionship", serviceId: x.choice.serviceId || null,
          segmentCount: x.quantity, baseUnitPrice: x.basePrice, serviceUnitPrice: x.unitPrice,
          requestedStartsAt: taiwanIso(x.startsAt), actualEndsAt: taiwanIso(x.endsAt) })),
        rooms: lines.filter(x => x.choice.kind === "room").map(x => ({ roomId: x.choice.referenceId,
          segmentCount: x.quantity, unitPrice: x.unitPrice, requestedStartsAt: taiwanIso(x.startsAt), actualEndsAt: taiwanIso(x.endsAt) })),
        tips: lines.filter(x => x.choice.kind === "tip").map(x => ({ staffId: x.choice.staffId || null,
          amount: x.unitPrice, staffPercentage: x.staffPercentage })),
      };
      const result = await backfillApi.quote(sessionId, body);
      quotedRequest.current = body; setQuote(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "預覽失敗。"); }
    finally { setBusy(false); }
  }
  async function refreshAfterSave() {
    if (!mounted.current) return;
    setBusy(true);
    try { await onSaved(); onClose(); }
    catch { setError("補登已儲存，訂單清單讀取失敗；請重新讀取，勿再次新增。"); }
    finally { setBusy(false); }
  }
  async function submit() {
    const body = submittedRequest.current || (quote && quotedRequest.current
      ? { ...quotedRequest.current, quoteToken: quote.quoteToken } : null);
    if (!body) return;
    submittedRequest.current = body;
    setBusy(true); setError("");
    try {
      const number = await backfillApi.submit(sessionId, body);
      if (!mounted.current) return;
      setSavedNumber(number); setUncertain(false);
      await refreshAfterSave();
    } catch (failure) {
      const unknownResult = !(failure instanceof ApiError) || failure.status === 0 || failure.status >= 500;
      setUncertain(unknownResult);
      if (!unknownResult) { submittedRequest.current = null; setQuote(null); }
      setError(failure instanceof Error ? failure.message : "補登結果尚未確認。");
    } finally { setBusy(false); }
  }
  const eligibleCash = account?.records.filter(record => !record.isVoided && record.kind === "cash_receipt"
    && record.sourceKind === "unallocated" && !record.orderId && record.cashPeriodId
    && record.allocationStatus === "confirmed" && record.holdScope === "none"
    && !account.records.some(refund => !refund.isVoided && refund.kind === "cash_refund" && refund.reversesRecordId === record.id)) || [];
  const locked = busy || uncertain || !!savedNumber;
  return <section className="adminOrderInlinePanel adminAssistedOrderPanel">
    <header><div><h2>補登已成交訂單</h2><p>營業日 {businessDate}；店員可在關店或結算後補登。服務直接記為已完成，顧客點餐不會重新開放。</p></div>
      <AdminButton variant="ghost" disabled={busy} onClick={onClose}>關閉</AdminButton></header>
    <p className="adminOrderFinanceNotice">請核對原成交價格；下方預設價格來自現行菜單，可修改為當時金額。所有時間均為台灣時間。已正式結算的金額保留，由經理重新結算後產生新版本。</p>
    <fieldset disabled={locked || !catalog || !account} className="adminOrderBackfillFields">
      <label>實際發生時間<input type="datetime-local" required value={occurredAt} onChange={e => { setOccurredAt(e.target.value); changed(); }} /></label>
      <label>補登原因（必填）<textarea required rows={2} maxLength={500} value={reason} onChange={e => { setReason(e.target.value); changed(); }} /></label>
      <div className="adminInlineFields"><label>加入品項<select value={choiceKey} onChange={e => setChoiceKey(e.target.value)}>
        <option value="">請選擇</option>{catalog?.choices.map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
      </select></label><AdminButton variant="secondary" disabled={!choiceKey} onClick={addLine}>加入</AdminButton></div>
      {lines.map(line => <fieldset key={line.id} className="adminOrderBackfillLine"><legend>{line.choice.label}</legend>
        {line.choice.isChampagneTower && <label>香檳塔贈送對象<select value={line.recipientStaffId || ""}
          onChange={e => updateLine(line.id, { recipientStaffId: e.target.value })}><option value="">送給店家</option>
          {catalog?.choices.filter(choice => choice.kind === "nomination" && !choice.serviceId).map(choice =>
            <option key={choice.key} value={choice.staffId}>{choice.label.replace("｜純陪伴", "")}</option>)}
        </select></label>}
        {line.choice.kind !== "tip" && <label>{line.choice.kind === "item" || line.choice.kind === "set" ? "份數" : "購買節數"}
          <input type="number" min={1} max={line.choice.kind === "item" || line.choice.kind === "set" ? 99 : 72} value={line.quantity}
            onChange={e => updateLine(line.id, { quantity: Number(e.target.value) })} /></label>}
        {line.choice.kind === "nomination" && <label>原指名費／節<input type="number" min={0} max={10000000} value={line.basePrice}
          onChange={e => updateLine(line.id, { basePrice: Number(e.target.value) })} /></label>}
        {(line.choice.kind !== "nomination" || line.choice.serviceId) && <label>{line.choice.kind === "tip" ? "小費總額" : line.choice.kind === "nomination" ? `原服務價${line.choice.duration ? "（整次，含加人費）" : "／節（含加人費）"}` : line.choice.kind === "room" ? "原包廂價／節" : "原成交單價"}
          <input type="number" min={line.choice.kind === "tip" ? 1 : 0} max={line.choice.kind === "tip" ? 1000000 : 10000000} value={line.unitPrice}
            onChange={e => updateLine(line.id, { unitPrice: Number(e.target.value) })} /></label>}
        {(line.choice.kind === "nomination" || line.choice.kind === "room") && <>
          <label>實際開始<input type="datetime-local" value={line.startsAt} onChange={e => updateLine(line.id, { startsAt: e.target.value })} /></label>
          <label>實際結束<input type="datetime-local" value={line.endsAt} onChange={e => updateLine(line.id, { endsAt: e.target.value })} /></label>
        </>}
        {line.choice.kind === "tip" && line.choice.staffId && <label>指定店員比例 %<input type="number" min={0} max={100} value={line.staffPercentage}
          onChange={e => updateLine(line.id, { staffPercentage: Number(e.target.value) })} /></label>}
        <AdminButton variant="ghost" onClick={() => { setLines(current => current.filter(x => x.id !== line.id)); changed(); }}>移除此項</AdminButton>
      </fieldset>)}
      <label>關聯已登錄收款（選填）<select value={cashId} onChange={e => { setCashId(e.target.value); changed(); }}>
        <option value="">暫不關聯；本次不新增實收</option>{eligibleCash.map(record => <option key={record.id} value={record.id}>
          {record.occurredAt.slice(0, 16).replace("T", " ")} · {money(record.amount)} · {record.reason}
        </option>)}
      </select></label>
      <p>只可整筆關聯本顧客已確認、未作廢且未歸屬的收款，金額不可超過本訂單。混合收款請先在帳款拆分；未登錄收款請於補登後另外登記。</p>
      {account?.records.some(x => !x.isVoided && x.kind === "charge_add" && x.sourceKind === "unallocated") &&
        <p className="adminFormError">本顧客已有未歸屬加收應付；若就是本次漏單，請先核對並更正，避免重複增加應收。</p>}
      <AdminButton disabled={!lines.length || !reason.trim() || !occurredAt} onClick={() => void preview()}>預覽補登金額</AdminButton>
      <AdminButton variant="ghost" onClick={() => { setBusy(true); financeApi.account(sessionId).then(value => { setAccount(value); changed(); })
        .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "帳款讀取失敗。" )).finally(() => setBusy(false)); }}>重新讀取帳款</AdminButton>
    </fieldset>
    {quote && !savedNumber && !uncertain && <div className="adminAssistedQuote"><ul>{quote.charges.map((charge, index) => <li key={index}>
      {charge.name} · {money(charge.unitPrice)} × {charge.quantity} = {money(charge.lineTotal)}</li>)}</ul>
      <strong>應收 {money(quote.totalAmount)} · 信物折抵 {money(quote.mealCreditApplied)}</strong>
      <AdminButton disabled={busy} onClick={() => void submit()}>確認補登已成交訂單</AdminButton></div>}
    {error && <p className="adminFormError" role="alert">{error}</p>}
    {uncertain && <div role="status"><p>送出結果尚未確認，已保留原操作。請查回同一筆，避免另建訂單。</p>
      <AdminButton disabled={busy} onClick={() => void submit()}>查回／重試原補登</AdminButton></div>}
    {savedNumber && <p role="status">已補登 {savedNumber}。<AdminButton disabled={busy} onClick={() => void refreshAfterSave()}>重新讀取訂單</AdminButton></p>}
  </section>;
}
