"use client";

import { useState } from "react";
import { financeApi } from "./finance-api";
import type { AdmissionEntry, FinanceAccount, FinanceCase, FinancePeriodOption } from "./finance-types";

const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;

export function AdmissionAndCasesPanel({ sessionId, account, periods, admission, cases, onSaved }: {
  sessionId: string; account: FinanceAccount; periods: FinancePeriodOption[]; admission: AdmissionEntry | null;
  cases: FinanceCase[]; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(admission?.amount ?? 0);
  const [discount, setDiscount] = useState(admission?.discountAmount ?? 0);
  const [credit, setCredit] = useState(admission?.creditAmount ?? 0);
  const [mode, setMode] = useState<"received" | "unpaid" | "waived">(admission?.status === "unpaid" ? "unpaid" : admission?.status === "waived" ? "waived" : "received");
  const [cashPeriod, setCashPeriod] = useState(admission?.cashPeriodId ?? "");
  const [reason, setReason] = useState(admission?.reason ?? "現場入場費");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitAdmission = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await financeApi.saveAdmission(sessionId, { operationId: crypto.randomUUID(), expectedVersion: account.version,
        amount, discountAmount: discount, creditAmount: credit, mode, cashPeriodId: cashPeriod || null, reason });
      setMessage("入場帳已記錄；重發點餐碼不會重複入帳。"); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "入場帳儲存失敗"); }
    finally { setBusy(false); }
  };
  const updateDeparture = async (action: "depart" | "void" | "reopen") => {
    setBusy(true); setMessage("");
    try { await financeApi.departure(sessionId, { operationId: crypto.randomUUID(), action, reason: action === "depart" ? "顧客正常離店" : action === "void" ? "誤開點餐碼作廢" : "重新開放點餐" }); setMessage(action === "depart" ? "已停止新單，既有訂單保留。" : action === "void" ? "已作廢未使用的點餐碼。" : "已重新開放點餐。"); onSaved(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "離店操作失敗"); }
    finally { setBusy(false); }
  };
  const resolve = async (item: FinanceCase) => {
    setBusy(true); setMessage("");
    try { await financeApi.resolveCase(sessionId, item.id, { operationId: crypto.randomUUID(), expectedVersion: account.version, cashPeriodId: item.caseKind === "pending_allocation" || item.caseKind === "pending_refund" ? (cashPeriod || null) : null, resolutionNote: "現場確認完成" }); setMessage("未決案件已確認，未再次產生收退款。"); onSaved(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "案件確認失敗"); }
    finally { setBusy(false); }
  };
  return <div className="adminOrderEmergency">
    <h4>入場實收與離店</h4>
    <p>同一顧客只建立一筆入場事件。折讓只調整應付；實收與實退代表現場已發生的金流。</p>
    {!admission ? <form onSubmit={submitAdmission}>
      <label>入場費<input type="number" min="0" step="1" value={amount} onChange={e => setAmount(Number(e.target.value))} required /></label>
      <label>折讓／優惠<input type="number" min="0" step="1" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></label>
      <label>餐點折抵額度<input type="number" min="0" step="1" value={credit} onChange={e => setCredit(Number(e.target.value))} /></label>
      <label>入場狀態<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="received">已收款</option><option value="unpaid">未收款，轉未決</option><option value="waived">免收／全額優惠</option></select></label>
      {mode === "received" && <label>收款營業日<select value={cashPeriod} onChange={e => setCashPeriod(e.target.value)}><option value="">先記實收，稍後歸屬</option>{periods.map(p => <option key={p.id} value={p.id}>{p.businessDate}</option>)}</select></label>}
      <label>原因<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)} required /></label>
      <button type="submit" disabled={busy}>記錄已收並完成入場</button>
    </form> : <p>入場費 {money(admission.amount)} · 折讓 {money(admission.discountAmount)} · 狀態 {admission.status === "received" ? "已收款" : admission.status === "unpaid" ? "未收款" : "優惠／免收"} · 已防重複入帳</p>}
    <div><button type="button" disabled={busy} onClick={() => void updateDeparture("depart")}>正常離店／停新單</button><button type="button" disabled={busy} onClick={() => void updateDeparture("void")}>誤開碼作廢</button><button type="button" disabled={busy} onClick={() => void updateDeparture("reopen")}>重新開放</button></div>
    {message && <p role="status">{message}</p>}
    {cases.length > 0 && <div><h5>未決案件</h5>{cases.map(item => <div key={item.id}><strong>{item.caseKind} · {money(item.amount)}</strong><span> · {item.description}</span>{item.status === "open" && <button type="button" disabled={busy} onClick={() => void resolve(item)}>確認歸屬／結轉</button>}</div>)}</div>}
  </div>;
}
