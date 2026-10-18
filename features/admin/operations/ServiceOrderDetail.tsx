import { useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { OrderFulfillmentPanel } from "@/features/admin/orders/OrderFulfillmentPanel";
import { ServiceOrderReceiptPanel } from "./ServiceOrderReceiptPanel";
import type { OperationsOrder } from "./operationsTypes";

export function ServiceOrderDetail({ order, disabled, periodId, businessDate, refreshKey, sourceMissing, onChanged, onBusy, onPendingChange }: {
  order: OperationsOrder; disabled: boolean; periodId: string; businessDate: string; refreshKey: number; sourceMissing: boolean;
  onChanged: () => Promise<void>; onBusy: (busy: boolean) => void; onPendingChange: (pending: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState(order.customerLocation || "");
  const [note, setNote] = useState(order.customerNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const act = async (request: () => Promise<unknown>) => {
    if (busy || disabled) return;
    setBusy(true); onBusy(true); setError("");
    try { await request(); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "處理失敗，請重新讀取確認。"); }
    finally { setBusy(false); onBusy(false); }
  };
  const blocked = disabled || busy;
  return <div className="serviceTaskDetail">
    <p>顧客位置：{order.customerLocation || "未提供"} · {order.customerNote || "無顧客備註"}</p>
    {sourceMissing && <p role="status">此單已離開目前服務清單，處理面板仍保留；請以下方重新讀取的服務與帳款資料為準。</p>}
    <div className="serviceOrderColumns">
      <section className="serviceOrderService" aria-label="服務處理">
        <h3>服務處理</h3>
        {error && <p role="alert">{error}</p>}
        {!sourceMissing && order.storeConfirmationStatus === "pending" ? <div className="serviceCoordinationForm"><p>接受後仍需被指名人員確認自己的服務。</p>
      <label>處理原因<input maxLength={500} disabled={blocked} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="adminPageActions"><AdminButton disabled={blocked} onClick={() => void act(() => adminApi.decideStoreConfirmation(order.id, "approved", reason.trim() || "現場確認可承接"))}>接受協調單</AdminButton><AdminButton variant="danger" disabled={blocked || !reason.trim()} onClick={() => void act(() => adminApi.decideStoreConfirmation(order.id, "rejected", reason.trim()))}>拒絕協調單</AdminButton></div>
        </div> : null}
        {(order.flowVersion || 1) >= 2 ? <OrderFulfillmentPanel orderId={order.id} refreshKey={String(refreshKey)} onChanged={onChanged} disabled={blocked || !sourceMissing && order.storeConfirmationStatus === "pending"} onBusy={onBusy} /> : <p>此歷史訂單沿用整單進度，請至完整點單管理核對。</p>}
      </section>
      <ServiceOrderReceiptPanel order={order} cashPeriodId={periodId} businessDate={businessDate} refreshKey={refreshKey} sourceMissing={sourceMissing} disabled={blocked} onBusy={onBusy} onChanged={onChanged} onPendingChange={onPendingChange} />
    </div>
    <details><summary>修改位置與顧客備註</summary><label>位置<input maxLength={200} value={location} disabled={blocked} onChange={(e) => setLocation(e.target.value)} /></label><label>備註<textarea maxLength={500} value={note} disabled={blocked} onChange={(e) => setNote(e.target.value)} /></label><AdminButton variant="secondary" disabled={blocked} onClick={() => void act(() => adminApi.updateOrder(order.id, { customerLocation: location, customerNote: note }))}>儲存位置／備註</AdminButton></details>
    <a className="adminButton adminButton-ghost" href={`/admin/orders?${new URLSearchParams({ date: order.sessionBusinessDate || businessDate, session: order.sessionId, order: order.id })}`}>完整處理此顧客</a>
  </div>;
}
