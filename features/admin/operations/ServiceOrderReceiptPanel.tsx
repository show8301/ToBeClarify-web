"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { financeApi } from "@/features/admin/orders/finance-api";
import type { FinanceAccount } from "@/features/admin/orders/finance-types";
import { WorkbenchOrderReceiptForm } from "./WorkbenchOrderReceiptDialog";
import { errorText, workbenchApi } from "./workbenchApi";
import type { OperationsOrder } from "./operationsTypes";

type Props = {
  order: OperationsOrder; cashPeriodId: string; businessDate: string; refreshKey: number; sourceMissing: boolean;
  disabled: boolean; onBusy: (busy: boolean) => void; onChanged: () => Promise<void>;
  onPendingChange: (pending: boolean) => void;
};
type ReceiptData = { account: FinanceAccount; pricing: Awaited<ReturnType<typeof workbenchApi.orderPricing>> };

export function ServiceOrderReceiptPanel({ order, cashPeriodId, businessDate, refreshKey, sourceMissing, disabled, onBusy, onChanged, onPendingChange }: Props) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: ReceiptData | null; error: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const key = `${order.id}:${cashPeriodId}:${refreshKey}:${revision}`;
  const reload = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    try {
      const [account, pricing] = await Promise.all([
        financeApi.account(order.sessionId, request.signal), workbenchApi.orderPricing(order.sessionId, order.id, request.signal),
      ]);
      if (request.signal.aborted) throw new Error("帳款讀取已取消，請重新核對。");
      setResult({ key, data: { account, pricing }, error: "" });
    } catch (e) {
      if (!request.signal.aborted) setResult((previous) => ({ key, data: previous?.data || null, error: errorText(e) }));
      throw e;
    }
  }, [key, order.id, order.sessionId]);
  useEffect(() => {
    void reload().catch(() => { /* The panel keeps the read error visible. */ });
    return () => controller.current?.abort();
  }, [reload]);
  const data = result?.data;
  const ready = result?.key === key && !result.error;
  const committed = (message: string) => {
    setFeedback(message);
    setRevision((value) => value + 1);
    void onChanged().catch(() => setFeedback(`${message} 現場清單更新失敗，請重新整理；收款已記錄。`));
  };
  const reportPending = useCallback((value: boolean) => { setPending(value); onPendingChange(value); }, [onPendingChange]);

  return <section className="serviceOrderReceipt" aria-label="收款登記">
    <h3>收款登記</h3>
    {feedback && <p role="status">{feedback}</p>}
    {!ready && result?.key !== key && <p role="status">正在核對本單帳款；尚未送出的輸入會保留。</p>}
    {result?.key === key && result.error && <div role="alert"><p>帳款讀取失敗：{result.error}</p><AdminButton variant="ghost" disabled={disabled || pending} onClick={() => void reload().catch(() => {})}>重新核對帳款</AdminButton></div>}
    {data && <WorkbenchOrderReceiptForm
      order={{ ...order, status: data.pricing.status, totalAmount: data.pricing.totalAmount }} account={data.account}
      cashPeriodId={cashPeriodId} businessDate={businessDate} disabled={disabled || !ready && !pending}
      onCommitted={committed} onBusy={onBusy} onReload={reload} onPendingChange={reportPending} showOrderBreakdown={!sourceMissing}
    />}
    <a className="adminButton adminButton-ghost" href={`/admin/orders?${new URLSearchParams({ date: order.sessionBusinessDate || businessDate, session: order.sessionId, order: order.id })}`}>完整點單管理</a>
  </section>;
}
