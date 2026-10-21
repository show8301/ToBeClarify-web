import type { SettlementOverview } from "./types";
import { settlementExactMoney as exactMoney } from "./presentation";

export function SettlementPublicTips({ overview, reason, editable, onReasonChange }: {
  overview: SettlementOverview;
  reason: string;
  editable: boolean;
  onReasonChange: (reason: string) => void;
}) {
  const pool = overview.publicTipPool;
  const legacy = (overview.run.calculationVersion ?? 1) < 4 && overview.run.publicTipAmount > 0;
  return <section aria-label="公共小費來源">
    <p>由小費訂單及有效實收自動彙總，不需手動輸入。依指名人員、服務員及經理的主要職位計薪工時分配，幕後職位不參與。</p>
    {pool ? <>
      <p>目前來源認列 {exactMoney(pool.recognizedAmount)} G；可分配 <strong>{exactMoney(pool.distributableAmount)} G</strong>。
        未滿 1 G 的部分不分配；整數尾差依最大餘數及固定人員順序處理。</p>
      {overview.run.status === "finalized" && <p>此處為目前訂單來源；已結算薪資仍保留原版本，需經理預覽差額並填原因重新結算。</p>}
      {pool.sources.length ? <ul className="adminSettlementSourceOrders">{pool.sources.map(source => <li key={source.orderId}>
        <a href={`/admin/notifications/orders/${encodeURIComponent(source.orderId)}`} target="_blank" rel="noopener noreferrer">{source.orderNumber}</a>
        <p>公共小費 {exactMoney(source.originalAmount)} G；本單應收 {exactMoney(source.orderPayableAmount)} G／認列實收 {exactMoney(source.orderCollectedAmount)} G。</p>
        <strong>本次認列 {exactMoney(source.recognizedAmount)} G</strong> · {source.status}
      </li>)}</ul> : <p>目前沒有公共小費訂單。既有店家小費若應分給員工，請至訂單的「訂單小費分配」更正類型。</p>}
      {!!pool.legacyStoreSources?.length && <details>
        <summary>舊店家小費待核對 · {pool.legacyStoreSources.length} 筆 · {exactMoney(pool.legacyStoreSources.reduce((sum, source) => sum + source.originalAmount, 0))} G</summary>
        <p>以下仍依舊分配歸店家，未加入公共小費池。請核對原意後至該顧客的「訂單小費分配」更正，不要重登訂單或收款。</p>
        <ul>{pool.legacyStoreSources.map(source => <li key={source.orderId}>
          <a href={`/admin/notifications/orders/${encodeURIComponent(source.orderId)}`} target="_blank" rel="noopener noreferrer">{source.orderNumber}</a>
          · 舊店家份額 {exactMoney(source.originalAmount)} G · 可認列實收份額 {exactMoney(source.recognizedAmount)} G
        </li>)}</ul>
      </details>}
    </> : <p role="status">目前 API 尚未提供公共小費來源，請重新讀取；勿重複補登小費。</p>}
    {legacy && <div role="alert">
      <p>此結算有舊手動公共小費 {exactMoney(overview.run.publicTipAmount)} G。請先核對並補齊來源訂單與實收，避免重複計薪。填寫核對原因後，本次保存／重新結算將以訂單彙總取代舊手動金額。</p>
      <label>舊手動公共小費核對原因<input maxLength={500} value={reason} disabled={!editable}
        onChange={event => onReasonChange(event.target.value)} placeholder="說明原金額對應哪些訂單及如何排除重複" /></label>
    </div>}
  </section>;
}
