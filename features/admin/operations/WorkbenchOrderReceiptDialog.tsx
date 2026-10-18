"use client";

import { useEffect, useRef, useState } from "react";
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
  const [pending, setPending] = useState(false);
  return <AdminDialog open title="同單收款" description={`${order.customerName} · ${order.orderNumber}`} className="adminDesignatedWorkbenchDialog" onClose={() => { if (!pending) onClose(); }} actions={null}>
    <WorkbenchOrderReceiptForm order={order} account={account} cashPeriodId={cashPeriodId} businessDate={businessDate} onClose={onClose} onCommitted={onCommitted} onBusy={onBusy} onPendingChange={setPending} />
  </AdminDialog>;
}

export function WorkbenchOrderReceiptForm({ order, account, cashPeriodId, businessDate, onClose, onCommitted, onBusy, disabled = false, onReload, onPendingChange, showOrderBreakdown = true }: {
  order: OperationsOrder; account: FinanceAccount; cashPeriodId: string; businessDate: string;
  onClose?: () => void; onCommitted: (message: string) => void; onBusy: (busy: boolean) => void;
  disabled?: boolean; onReload?: () => Promise<void>; onPendingChange?: (pending: boolean) => void; showOrderBreakdown?: boolean;
}) {
  const summary = orderFinance(order, account);
  const [amountInput, setAmountInput] = useState<string | null>(null);
  const amount = amountInput === null ? Math.max(0, summary.balance) : Number(amountInput);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<FinanceSaveRequest | null>(null);
  const [mustReload, setMustReload] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    onPendingChange?.(busy || Boolean(retry));
    return () => onPendingChange?.(false);
  }, [busy, retry, onPendingChange]);
  const save = async () => {
    if (lock.current || disabled || mustReload || !retry && (summary.blockedReason || !cashPeriodId || !Number.isSafeInteger(amount) || amount < 1 || amount > summary.balance)) return;
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
      setAmountInput(null); setNote("");
      onCommitted(`${order.orderNumber} 已記錄實收 ${formatMoney(body.amount)}。`);
    } catch (e: unknown) {
      setError(errorText(e));
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        setRetry(null); setMustReload(true);
      }
    } finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  const reload = async () => {
    if (!onReload || lock.current || retry) return;
    lock.current = true; setBusy(true); setError("");
    try { await onReload(); setMustReload(false); }
    catch (e) { setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <form className="dwOrderActionForm" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {showOrderBreakdown && <div className="dwReceiptItems" aria-label="本單品項">{order.items?.map((item, index) => <div key={item.id || `${item.name}-${index}`}><span>{item.name} × {item.quantity}</span><strong>{item.lineTotal === undefined ? "—" : formatMoney(item.lineTotal)}</strong></div>)}</div>}
      <dl className="dwReceiptTotals">
        {showOrderBreakdown && order.subtotal !== undefined && <div><dt>商品小計</dt><dd>{formatMoney(order.subtotal)}</dd></div>}
        {showOrderBreakdown && order.mealCreditApplied !== undefined && <div><dt>入場費折抵（僅餐點）</dt><dd>−{formatMoney(order.mealCreditApplied)}</dd></div>}
        {summary.additions > 0 && <div><dt>本單加收</dt><dd>{formatMoney(summary.additions)}</dd></div>}
        {summary.reductions > 0 && <div><dt>本單折讓</dt><dd>−{formatMoney(summary.reductions)}</dd></div>}
        <div><dt>本單應收</dt><dd>{formatMoney(summary.receivable)}</dd></div>
        <div><dt>已實收</dt><dd>{formatMoney(summary.received)}</dd></div>
        {summary.refunded > 0 && <div><dt>已退款</dt><dd>{formatMoney(summary.refunded)}</dd></div>}
        <div className="isBalance"><dt>本單尚欠</dt><dd>{formatMoney(Math.max(0, summary.balance))}</dd></div>
      </dl>
      <fieldset disabled={disabled || busy || Boolean(retry) || mustReload}>
        <AdminField label="本次實際收到（G）" required><input type="number" required min={1} max={Math.max(0, summary.balance)} step={1} value={amountInput ?? amount} onChange={(event) => setAmountInput(event.target.value)} /></AdminField>
        <AdminField label="收款備註（選填）"><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></AdminField>
      </fieldset>
      <p>收款營業日：{businessDate}。此筆實收歸屬本張訂單，服務進度另外記錄。</p>
      {summary.blockedReason && <p className="adminFormError" role="alert">{summary.blockedReason}</p>}
      {summary.balance < 0 && <p role="status">本單待退款 {formatMoney(-summary.balance)}，請至完整點單管理處理。</p>}
      {error && <p className="adminFormError" role="alert">{error}</p>}
      {retry && !busy && <p role="status">操作結果尚未確認，請查回同一筆收款結果。</p>}
      {mustReload && <p role="status">請重新核對帳款與尚欠金額；輸入內容已保留。</p>}
      <div className="dwActions">
        <AdminButton type="submit" disabled={disabled || busy || mustReload || !retry && (Boolean(summary.blockedReason) || !cashPeriodId || summary.balance <= 0)}>{busy ? "處理中…" : retry ? "查回／重試同一筆收款" : `確認實收 ${formatMoney(amount)}`}</AdminButton>
        {onReload && <AdminButton variant="ghost" disabled={busy || Boolean(retry)} onClick={() => void reload()}>重新核對帳款</AdminButton>}
        {onClose && <AdminButton variant="ghost" disabled={busy || Boolean(retry)} onClick={onClose}>返回</AdminButton>}
      </div>
  </form>;
}
