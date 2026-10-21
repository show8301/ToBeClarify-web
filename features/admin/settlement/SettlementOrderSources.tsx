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
        （已扣退款與保留款，最高以本單應收為限）。
      </p> : null}
      <ul className="adminSettlementSourceItems">
        {rows.map((source) => <li key={`${source.orderItemId || source.label}-${source.percentage}`}>
          <div>
            <span className="adminSettlementSourceItemName">{source.itemName || source.label}</span>
            {source.itemName ? <span>{source.label}</span> : null}
            {source.originalAmount != null ? <span>{kind === "public_tip" ? "原始公共小費" : kind === "designated_tip" ? "原始員工份額" : "原始品項金額"} {exactMoney(source.originalAmount)} G</span> : null}
            {source.afterCreditAmount != null ? <>
              <span>品項取消 −{exactMoney(source.cancelledAmount ?? 0)} G；本品項餐飲折抵 −{exactMoney(source.mealCreditAmount ?? 0)} G；折抵後 {exactMoney(source.afterCreditAmount)} G</span>
              {source.orderRevenueAmount != null && source.orderRevenueAmount > 0 && source.adjustedRevenueAmount != null ? <span>
                訂單營收調整比例 {exactMoney(source.adjustedRevenueAmount)} ÷ {exactMoney(source.orderRevenueAmount)}（不含小費）
              </span> : null}
              {source.orderPayableAmount != null && source.orderPayableAmount > 0 && source.orderCollectedAmount != null ? <span>
                有效實收比例 {exactMoney(source.orderCollectedAmount)} ÷ {exactMoney(source.orderPayableAmount)}
              </span> : null}
            </> : kind === "designated_revenue" ? <span>此版本未保存逐項取消、折抵與認列比例；請由經理預覽重新結算以核對新版結果。</span> : null}
            <span>認列基礎 {exactMoney(source.basisAmount)} G × {exactMoney(source.percentage)}%{kind === "public_tip" ? "（含整數尾差分配）" : ""}</span>
          </div>
          <strong>{exactMoney(source.amount)} G</strong>
        </li>)}
      </ul>
    </li>)}
  </ul>;
}
