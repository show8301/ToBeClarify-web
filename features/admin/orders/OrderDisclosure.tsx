"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { orderStatusLabels } from "./order-presentation";
import type { FulfillmentReadState } from "./fulfillment-progress";

type Props = {
  orderNumber: string;
  status: string;
  amount: number;
  submittedAt: string;
  storePending?: boolean;
  progress?: FulfillmentReadState;
  children: ReactNode;
};

export function OrderDisclosure({ orderNumber, status, amount, submittedAt, storePending = false, progress, children }: Props) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const finished = !storePending && (progress ? progress.kind === "ready" && progress.allFinished
    : ["completed", "cancelled", "rejected"].includes(status));
  const open = manualOpen ?? !finished;
  const currentStatus = progress?.kind === "ready" ? progress.orderStatus : status;
  const statusLabel = storePending ? "等待店員接受協調單" : orderStatusLabels[currentStatus] || currentStatus;
  const hint = progress?.kind === "loading" ? "核對項目中…" : progress?.kind === "error" ? "履約狀態讀取失敗，請展開重試"
    : progress?.kind === "ready" && !finished ? storePending ? "尚待接受協調單"
      : progress.totalCount === 0 ? "尚無分項，狀態待確認" : `未完成 ${progress.unfinishedCount} 項` : "";
  const time = Date.parse(submittedAt);
  useEffect(() => {
    const details = detailsRef.current;
    const body = details?.querySelector(".adminOrderDisclosureBody");
    if (!open && body?.contains(document.activeElement)) details?.querySelector("summary")?.focus();
  }, [open]);

  return <details ref={detailsRef} className={`adminOrderCard adminOrderDisclosure ${finished ? "isFinished" : "hasUnfinished"}`} open={open}
    onToggle={(event) => { if (event.currentTarget.open !== open) setManualOpen(event.currentTarget.open); }}>
    <AdminDisclosureSummary className="adminOrderSummary">
      <span className="adminOrderSummaryLine">
        <strong className="adminOrderSummaryStatus">{statusLabel}</strong>
        <span className="adminOrderSummaryNumber"><span>單號</span><strong>{orderNumber}</strong></span>
        <span className="adminOrderSummaryAmount"><span>應付</span><strong>{amount.toLocaleString("zh-TW")} G</strong></span>
        <time dateTime={Number.isFinite(time) ? submittedAt : undefined}>{Number.isFinite(time)
          ? new Date(time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "下單時間待確認"}</time>
        {hint && <span className="adminOrderSummaryProgress">{hint}</span>}
      </span>
    </AdminDisclosureSummary>
    <div className="adminOrderDisclosureBody">{children}</div>
  </details>;
}
