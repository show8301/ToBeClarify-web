import { useEffect, useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { financeApi } from "./finance-api";
import { FINANCE_UPDATED, isFinanceUpdateFor } from "./finance-events";
import type { AdmissionEntry, FinanceAccount } from "./finance-types";

const money = (n: number) => `${n.toLocaleString("zh-TW")} G`;
const statuses: Record<string, string> = { received: "開碼時已收款", unpaid: "開碼時未收款", waived: "免收", reissue: "重發紀錄" };

export function AdmissionSummary({ sessionId, refreshKey = "" }: { sessionId: string; refreshKey?: string | number }) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = (event: Event) => { if (isFinanceUpdateFor(event, sessionId)) setRevision((v) => v + 1); };
    window.addEventListener(FINANCE_UPDATED, changed);
    return () => window.removeEventListener(FINANCE_UPDATED, changed);
  }, [sessionId]);
  const key = `${sessionId}:${refreshKey}:${revision}`;
  const [state, setState] = useState<{ key: string; admission: AdmissionEntry | null; account: FinanceAccount | null; error: string } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    Promise.all([financeApi.admission(sessionId, c.signal), financeApi.account(sessionId, c.signal)])
      .then(([admission, account]) => { if (!c.signal.aborted) setState({ key, admission, account, error: "" }); })
      .catch((e: unknown) => { if (!c.signal.aborted) setState({ key, admission: null, account: null, error: e instanceof Error ? e.message : "入場帳讀取失敗。" }); });
    return () => c.abort();
  }, [sessionId, key]);
  const current = state?.key === key ? state : null;
  const account = current?.account;
  const admission = current?.admission;
  const records = account?.records.filter((r) => r.sourceKind === "admission") || [];
  const sum = (kind: string) => records.filter((r) => r.kind === kind).reduce((total, r) => total + r.amount, 0);
  return <section className="adminAdmissionSummary" aria-label="入場費與本次消費帳單">
    <h3>入場費與本次消費</h3>
    {!current ? <p role="status">讀取入場帳中…</p> : current.error ? <div role="alert"><p>{current.error}</p><AdminButton variant="ghost" onClick={() => setRevision((v) => v + 1)}>重試入場帳</AdminButton></div> : <>
      <p>{admission ? statuses[admission.status] || admission.status : account?.admissionChargeRecorded ? "已有入場帳款紀錄" : "入場費尚未登錄，不推定已收"}</p>
      {admission && <p>入場費 {money(admission.amount)} · 優惠 {money(admission.discountAmount)} · 餐點折抵額度 {money(admission.creditAmount)}</p>}
      <dl><div><dt>入場應付（含更正）</dt><dd>{money(sum("charge_add") - sum("charge_reduce"))}</dd></div><div><dt>入場實收／實退</dt><dd>{money(sum("cash_receipt"))}／{money(sum("cash_refund"))}</dd></div>
        {account && <><div><dt>本次消費應付（含入場）</dt><dd>{money(account.receivable)}</dd></div><div><dt>本次實收扣退款</dt><dd>{money(account.netCash)}</dd></div><div><dt>{account.balance < 0 ? "待退款" : "尚欠"}</dt><dd>{money(Math.abs(account.balance))}</dd></div></>}
      </dl>
      {records.filter((r) => r.kind === "cash_receipt" || r.kind === "cash_refund").map((r) => <small key={r.id}>{r.kind === "cash_receipt" ? "實收" : "實退"} {money(r.amount)} · {new Date(r.occurredAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })} · 經手帳號 {r.createdBy}</small>)}
    </>}
  </section>;
}
