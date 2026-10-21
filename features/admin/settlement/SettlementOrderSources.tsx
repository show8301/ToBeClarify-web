import type { SettlementResultSource } from "./types";
import { settlementExactMoney as exactMoney } from "./presentation";

type Props = {
  sources: SettlementResultSource[];
  kind: SettlementResultSource["kind"];
};

export function SettlementOrderSources({ sources, kind }: Props) {
  const orders = new Map<string, SettlementResultSource[]>();
  for (const source of sources) {
    if (source.kind !== kind) continue;
    const rows = orders.get(source.orderId) || [];
    rows.push(source);
    orders.set(source.orderId, rows);
  }
  if (!orders.size) return <p className="adminSettlementHint">沒有此項目的逐筆訂單來源。</p>;

  return <ul className="adminSettlementSourceOrders">
    {Array.from(orders, ([orderId, rows]) => <li key={orderId}>
      <div className="adminSettlementSourceOrderHeading">
        <a href={`/admin/notifications/orders/${encodeURIComponent(orderId)}`} target="_blank" rel="noopener noreferrer">
          {rows[0].orderNumber || `未提供單號（${orderId}）`}
        </a>
        <strong>本單{kind === "designated_revenue" ? "分成" : "小費"}合計 {exactMoney(rows.reduce((sum, row) => sum + row.amount, 0))} G</strong>
      </div>
      {rows[0].orderPayableAmount != null && rows[0].orderCollectedAmount != null ? <p>
        本單應收 {exactMoney(rows[0].orderPayableAmount)} G；認列實收 {exactMoney(rows[0].orderCollectedAmount)} G
        （已扣退款與保留款，最高以本單應收為限）。各品項依本單折抵及實收比例認列。
      </p> : null}
      <ul className="adminSettlementSourceItems">
        {rows.map((source) => <li key={`${source.orderItemId || source.label}-${source.percentage}`}>
          <div>
            <span className="adminSettlementSourceItemName">{source.itemName || source.label}</span>
            {source.itemName ? <span>{source.label}</span> : null}
            {source.originalAmount != null ? <span>{kind === "public_tip" ? "原始公共小費" : kind === "designated_tip" ? "原始員工份額" : "原始品項金額"} {exactMoney(source.originalAmount)} G</span> : null}
            <span>認列基礎 {exactMoney(source.basisAmount)} G × {exactMoney(source.percentage)}%{kind === "public_tip" ? "（含整數尾差分配）" : ""}</span>
          </div>
          <strong>{exactMoney(source.amount)} G</strong>
        </li>)}
      </ul>
    </li>)}
  </ul>;
}
