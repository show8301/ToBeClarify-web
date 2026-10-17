"use client";

import { useRef, useState } from "react";
import { ApiError } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { financeApi } from "../orders/finance-api";
import type { FinanceAccount, FinanceSaveRequest } from "../orders/finance-types";
import { orderFinance } from "./workbenchOrderProgress";
import { errorText, workbenchApi } from "./workbenchApi";
import { formatMoney } from "./operationsFormat";
import type { OperationsOrder } from "./operationsTypes";

export function WorkbenchOrderReceiptDialog({ order, account, cashPeriodId, businessDate, onClose, onCommitted, onBusy }: {
  order: OperationsOrder; account: FinanceAccount; cashPeriodId: string; businessDate: string;
  onClose: () => void; onCommitted: (message: string) => void; onBusy: (busy: boolean) => void;
}) {
  const summary = orderFinance(order, account);
  const [amount, setAmount] = useState(Math.max(0, summary.balance));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<FinanceSaveRequest | null>(null);
  const [mustReload, setMustReload] = useState(false);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current || mustReload || summary.blockedReason || !cashPeriodId || !Number.isSafeInteger(amount) || amount < 1 || amount > summary.balance) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      if (!retry) {
        const [latestAccount, latestOrder] = await Promise.all([
          financeApi.account(order.sessionId), workbenchApi.orderPricing(order.sessionId, order.id),
        ]);
        if (latestAccount.version !== account.version || latestOrder.totalAmount !== order.totalAmount ||
            ["cancelled", "expired", "rejected"].includes(latestOrder.status)) {
          throw new ApiError("訂單或帳款已更新，請返回重新核對尚欠金額。", { status: 409, code: "WORKBENCH_RECEIPT_CHANGED" });
        }
      }
      const body: FinanceSaveRequest = retry ?? {
        operationId: crypto.randomUUID(), expectedVersion: account.version, kind: "cash_receipt", amount,
        sourceKind: "order", orderId: order.id, orderItemId: null,
        sourcePeriodId: order.businessPeriodId || account.sourcePeriodId, cashPeriodId,
        occurredAt: new Date().toISOString(), allocationStatus: "confirmed", holdScope: "none",
        reason: note.trim() || `指名工作台同單收款：${order.orderNumber}`, reversesRecordId: null,
      };
      setRetry(body);
      const prior = await financeApi.operation(order.sessionId, body.operationId);
      if (!prior) await financeApi.save(order.sessionId, null, body);
      setRetry(null);
      onCommitted(`${order.orderNumber} 已記錄實收 ${formatMoney(body.amount)}。`);
    } catch (e: unknown) {
      setError(errorText(e));
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        setRetry(null); setMustReload(true);
      }
    } finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <AdminDialog open title="同單收款" description={`${order.customerName} · ${order.orderNumber}`} className="adminDesignatedWorkbenchDialog" onClose={() => { if (!busy && !retry) onClose(); }} actions={null}>
    <form className="dwOrderActionForm" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="dwReceiptItems" aria-label="本單品項">{order.items?.map((item, index) => <div key={item.id || `${item.name}-${index}`}><span>{item.name} × {item.quantity}</span><strong>{item.lineTotal === undefined ? "—" : formatMoney(item.lineTotal)}</strong></div>)}</div>
      <dl className="dwReceiptTotals">
        {order.subtotal !== undefined && <div><dt>商品小計</dt><dd>{formatMoney(order.subtotal)}</dd></div>}
        {order.mealCreditApplied !== undefined && <div><dt>入場費折抵（僅餐點）</dt><dd>−{formatMoney(order.mealCreditApplied)}</dd></div>}
        {summary.additions > 0 && <div><dt>本單加收</dt><dd>{formatMoney(summary.additions)}</dd></div>}
        {summary.reductions > 0 && <div><dt>本單折讓</dt><dd>−{formatMoney(summary.reductions)}</dd></div>}
        <div><dt>本單應收</dt><dd>{formatMoney(summary.receivable)}</dd></div>
        <div><dt>已實收</dt><dd>{formatMoney(summary.received)}</dd></div>
        {summary.refunded > 0 && <div><dt>已退款</dt><dd>{formatMoney(summary.refunded)}</dd></div>}
        <div className="isBalance"><dt>本單尚欠</dt><dd>{formatMoney(Math.max(0, summary.balance))}</dd></div>
      </dl>
      <fieldset disabled={busy || Boolean(retry) || mustReload}>
        <AdminField label="本次實際收到（G）" required><input type="number" required min={1} max={Math.max(0, summary.balance)} step={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></AdminField>
        <AdminField label="收款備註（選填）"><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></AdminField>
      </fieldset>
      <p>收款營業日：{businessDate}。此筆實收歸屬本張訂單，服務進度另外記錄。</p>
      {summary.blockedReason && <p className="adminFormError" role="alert">{summary.blockedReason}</p>}
      {error && <p className="adminFormError" role="alert">{error}</p>}
      {retry && !busy && <p role="status">操作結果尚未確認，請查回同一筆收款結果。</p>}
      {mustReload && <p role="status">請返回重新載入帳款，再核對尚欠金額。</p>}
      <div className="dwActions">
        <AdminButton type="submit" disabled={busy || mustReload || Boolean(summary.blockedReason) || !cashPeriodId || summary.balance <= 0}>{busy ? "處理中…" : retry ? "查回／重試同一筆收款" : `確認實收 ${formatMoney(amount)}`}</AdminButton>
        <AdminButton variant="ghost" disabled={busy || Boolean(retry)} onClick={onClose}>返回</AdminButton>
      </div>
    </form>
  </AdminDialog>;
}
