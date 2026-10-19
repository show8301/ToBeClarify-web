import { settlementMoney as money } from "./presentation";
import type { SettlementAnomaly, SettlementFinanceSource } from "./types";

type Props = { anomaly: SettlementAnomaly; businessDate: string };

const sourceKindLabels: Record<string, string> = { order: "整張訂單", item: "訂單品項", admission: "入場帳" };
const financeKindLabels: Record<string, string> = {
  cash_receipt: "收款", cash_refund: "退款", charge_add: "加收", charge_reduce: "折讓",
};
const allocationStatusLabels: Record<string, string> = {
  confirmed: "已確認", pending: "待確認", unpaid: "未收款", reversed: "已沖銷",
};

function FinanceSource({ source, anomaly, businessDate }: { source: SettlementFinanceSource; anomaly: SettlementAnomaly; businessDate: string }) {
  const query = new URLSearchParams();
  if (anomaly.sessionId) query.set("session", anomaly.sessionId);
  query.set("date", businessDate);
  if (source.orderId) query.set("order", source.orderId);
  const signedAmount = source.kind === "cash_refund" || source.kind === "charge_reduce" ? -source.amount : source.amount;
  return <article className="adminSettlementAnomalySource">
    <strong>{financeKindLabels[source.kind] || source.kind} · {signedAmount > 0 ? "+" : ""}{money(signedAmount)} G</strong>
    <span>{sourceKindLabels[source.sourceKind] || source.sourceKind}{source.itemName ? ` · ${source.itemName}` : ""}</span>
    <span>狀態：{allocationStatusLabels[source.allocationStatus] || source.allocationStatus} · 分潤保留：{source.holdScope === "none" ? "否" : source.holdScope}</span>
    <span>原因：{source.reason || "未填寫"}</span>
    <span>來源編號：{source.id}</span>
    {source.orderNumber ? <span>訂單：{source.orderNumber}</span> : null}
    {anomaly.sessionId ? <a href={`/admin/orders?${query.toString()}`} target="_blank" rel="noopener noreferrer">
      開啟{source.orderNumber ? `訂單 ${source.orderNumber}` : "顧客帳單"}
    </a> : null}
  </article>;
}

export function SettlementAnomalyDetails({ anomaly, businessDate }: Props) {
  const sources = anomaly.financeSources || [];
  if (!sources.length && !anomaly.sessionId && !anomaly.customerName) return null;
  return <div className="adminSettlementAnomalyDetails">
    {anomaly.customerName ? <strong>顧客：{anomaly.customerName}</strong> : null}
    {anomaly.sessionId && !sources.length ? <a href={`/admin/orders?${new URLSearchParams({ date: businessDate, session: anomaly.sessionId }).toString()}`}
      target="_blank" rel="noopener noreferrer">開啟此顧客帳單</a> : null}
    {sources.map(source => <FinanceSource key={source.id} source={source} anomaly={anomaly} businessDate={businessDate} />)}
  </div>;
}
