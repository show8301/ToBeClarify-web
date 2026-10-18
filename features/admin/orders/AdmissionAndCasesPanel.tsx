"use client";

import { useState } from "react";
import { financeApi } from "./finance-api";
import type { AdmissionEntry, FinanceAccount, FinanceCase, FinancePeriodOption } from "./finance-types";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";

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
  return <section className="adminOrderFinanceAdmission" aria-label="入場實收與離店">
    <header className="adminOrderAdmissionHeading">
      <div className="adminFieldHeading">
        <h4>入場實收與離店</h4>
        <AdminHelp title="入場實收與離店說明">每位顧客只建立一筆入場紀錄。折讓調整應付金額；實收、實退記錄現場已發生的收退款。</AdminHelp>
      </div>
      {admission && <div className="adminOrderAdmissionFacts">
        <dl>
          <div><dt>入場費</dt><dd>{money(admission.amount)}</dd></div>
          <div><dt>折讓</dt><dd>{money(admission.discountAmount)}</dd></div>
          <div><dt>狀態</dt><dd>{{ received: "已收款", unpaid: "未收款", waived: "優惠／免收", reissue: "重發紀錄" }[admission.status]}</dd></div>
        </dl>
        <span>已防重複入帳</span>
      </div>}
    </header>
    {!admission ? <form className="adminOrderFinanceAdmissionForm" onSubmit={submitAdmission}>
      <label>入場費<input type="number" min="0" step="1" value={amount} onChange={e => setAmount(Number(e.target.value))} required /></label>
      <label>折讓／優惠<input type="number" min="0" step="1" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></label>
      <label>餐點折抵額度<input type="number" min="0" step="1" value={credit} onChange={e => setCredit(Number(e.target.value))} /></label>
      <label>入場狀態<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="received">已收款</option><option value="unpaid">未收款，轉未決</option><option value="waived">免收／全額優惠</option></select></label>
      {mode === "received" && <label>收款營業日<select value={cashPeriod} onChange={e => setCashPeriod(e.target.value)}><option value="">先記實收，稍後歸屬</option>{periods.map(p => <option key={p.id} value={p.id}>{p.businessDate}</option>)}</select></label>}
      <label>原因<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)} required /></label>
      <AdminButton type="submit" disabled={busy}>記錄已收並完成入場</AdminButton>
    </form> : null}
    <div className="adminOrderFinanceActions"><AdminButton variant="secondary" disabled={busy} onClick={() => void updateDeparture("depart")}>正常離店／停新單</AdminButton><AdminButton variant="danger" disabled={busy} onClick={() => void updateDeparture("void")}>誤開碼作廢</AdminButton><AdminButton variant="ghost" disabled={busy} onClick={() => void updateDeparture("reopen")}>重新開放</AdminButton></div>
    {message && <p role="status">{message}</p>}
    {cases.length > 0 && <div className="adminOrderFinanceCases"><h5>未決案件</h5>{cases.map(item => <div key={item.id} className="adminOrderFinanceRecord"><div><strong>{item.caseKind}</strong><p>{item.description}</p></div><b>{money(item.amount)}</b>{item.status === "open" && <AdminButton variant="secondary" disabled={busy} onClick={() => void resolve(item)}>確認歸屬／結轉</AdminButton>}</div>)}</div>}
  </section>;
}
