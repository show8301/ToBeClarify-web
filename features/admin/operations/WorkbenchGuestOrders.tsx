"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { financeApi } from "../orders/finance-api";
import type { FinanceAccount } from "../orders/finance-types";
import { WorkbenchItemCompletionDialog } from "./WorkbenchItemCompletionDialog";
import { WorkbenchOrderReceiptDialog } from "./WorkbenchOrderReceiptDialog";
import { completionOption, orderFinance, orderProgress, unitProgressLabel } from "./workbenchOrderProgress";
import { errorText, serviceStatusLabels } from "./workbenchApi";
import { formatClock, formatMoney, orderStatusLabel } from "./operationsFormat";
import type { WorkbenchUnit } from "./workbenchApi";
import type { OperationsOrder } from "./operationsTypes";
import type { ServiceAction, ServiceEntry } from "./WorkbenchServiceDialog";

type Props = {
  orders: OperationsOrder[]; units: Record<string, WorkbenchUnit[]>; unavailable: boolean; disabled: boolean;
  cashPeriodId: string; businessDate: string; staffId: string; entries: ServiceEntry[];
  canAct: (entry: ServiceEntry, action: ServiceAction) => boolean;
  onServiceAction: (entry: ServiceEntry, action: ServiceAction) => void;
  onChanged: () => Promise<void>; onBusy: (busy: boolean) => void;
};
type Dialog = { kind: "complete"; order: OperationsOrder; unit: WorkbenchUnit }
  | { kind: "receipt"; order: OperationsOrder; account: FinanceAccount };

const kindLabels: Record<string, string> = { meal: "餐點", room: "包廂", nominee: "指名", addon: "加購", tip: "小費", other: "費用" };

export function WorkbenchGuestOrders({ orders, units, unavailable, disabled, cashPeriodId, businessDate, staffId, entries, canAct, onServiceAction, onChanged, onBusy }: Props) {
  const sessionId = orders[0]?.sessionId || "";
  const [revision, setRevision] = useState(0);
  const [finance, setFinance] = useState<{ orders: OperationsOrder[]; revision: number; account: FinanceAccount | null; error: string } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [feedback, setFeedback] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    financeApi.account(sessionId, controller.signal).then((account) => {
      if (!controller.signal.aborted) setFinance({ orders, revision, account, error: "" });
    }).catch((e: unknown) => {
      if (!controller.signal.aborted) setFinance({ orders, revision, account: null, error: errorText(e) });
    });
    return () => controller.abort();
  }, [sessionId, orders, revision]);
  const financeReady = finance?.orders === orders && finance.revision === revision;
  const account = financeReady ? finance.account : null;
  const blocked = disabled || unavailable || refreshing;
  const refresh = () => {
    setRevision((value) => value + 1); setRefreshing(true);
    void onChanged().catch(() => setFeedback("操作已記錄，但進度更新失敗，請重新整理。"))
      .finally(() => setRefreshing(false));
  };
  const committed = (message: string) => { setDialog(null); setFeedback(message); refresh(); };
  const close = () => { setDialog(null); refresh(); };
  return <div className="dwList dwGuestOrders">
    {feedback && <p className="dwNotice" role="status">{feedback}</p>}
    {financeReady && finance.error && <div className="dwNotice" role="alert"><p>帳款讀取失敗：{finance.error}</p><AdminButton variant="ghost" disabled={blocked} onClick={() => setRevision((value) => value + 1)}>重新載入帳款</AdminButton></div>}
    {orders.map((order) => {
      const orderUnits = units[order.id] || [];
      const progress = orderProgress(orderUnits);
      const summary = account ? orderFinance(order, account) : null;
      const terminal = ["cancelled", "expired", "rejected"].includes(order.status);
      const completionBlocked = blocked || terminal || order.storeConfirmationStatus === "pending";
      return <article className="dwGuestOrder" key={order.id} aria-label={`訂單 ${order.orderNumber}`}>
        <h4>{order.orderNumber}</h4>
        <div className="dwOrderStatuses">
          <span>處理進度：<strong>{unavailable ? "讀取中／待確認" : (order.flowVersion || 1) < 2 ? orderStatusLabel(order.status) : progress.label}</strong></span>
          <span>收款狀態：<strong>{summary?.label || (financeReady ? "帳款未確認" : "讀取中…")}</strong></span>
        </div>
        {!unavailable && order.status === "completed" && progress.total > progress.completed && <p className="adminFormError">整單狀態與分項進度不一致，請至完整點單管理核對。</p>}
        {(order.flowVersion || 1) >= 2 ? <div className="dwOrderUnits">
          {orderUnits.map((unit) => {
            const entry = entries.find((value) => value.unit?.id === unit.id);
            const own = unit.staffId === staffId && ["nominee", "addon"].includes(unit.kind);
            const action = completionOption(unit);
            const remaining = unit.quantity - unit.cancelledQuantity;
            return <div className="dwOrderUnit" key={unit.id}>
              <div className="dwOrderUnitCopy">
                <span className="dwOrderKind">{own ? `我的${kindLabels[unit.kind]}` : kindLabels[unit.kind] || unit.kind}</span>
                <strong>{unit.name}</strong>
                <span>{own && entry ? serviceStatusLabels[entry.status] || entry.status : unitProgressLabel(unit)} · 已完成 {unit.completedQuantity}／{remaining}</span>
                {unit.scheduledStartsAt && <span>{formatClock(unit.scheduledStartsAt)}–{formatClock(unit.scheduledEndsAt)}</span>}
              </div>
              <div className="dwOrderUnitActions">
                {action && <AdminButton variant="secondary" disabled={completionBlocked} onClick={() => setDialog({ kind: "complete", order, unit })}>{unit.kind === "meal" ? "確認已送達" : "確認使用完成"}</AdminButton>}
                {own && entry && (unit.kind === "nominee" ? ["accept", "start_now", "complete"] as const : ["start", "complete"] as const).filter((value) => canAct(entry, value)).map((value) => <AdminButton key={value} variant="secondary" disabled={completionBlocked} onClick={() => onServiceAction(entry, value)}>{value === "accept" ? "承接此指名" : value === "complete" ? unit.kind === "addon" ? "完成此加購" : "完成此指名" : unit.kind === "addon" ? "開始此加購" : "開始此指名"}</AdminButton>)}
              </div>
            </div>;
          })}
          {!orderUnits.length && <p role="status">{unavailable ? "讀取同單各項進度中…" : "尚未取得分項進度，請重新整理或至完整點單管理核對。"}</p>}
        </div> : <><ul className="dwLegacyItems">{order.items?.map((item, index) => <li key={item.id || `${item.name}-${index}`}>{item.name} × {item.quantity}</li>)}</ul><p>此歷史訂單沿用整單進度，請至完整點單管理核對。</p></>}
        {order.storeConfirmationStatus === "pending" && <p>此單等待店家承接，承接後可處理各項內容。</p>}
        {order.customerNote && <p>顧客備註：{order.customerNote}</p>}
        <div className="dwOrderCash">
          {summary && !summary.blockedReason ? <dl><div><dt>本單應收</dt><dd>{formatMoney(summary.receivable)}</dd></div><div><dt>已收（扣除退款）</dt><dd>{formatMoney(summary.netCash)}</dd></div><div><dt>{summary.balance < 0 ? "待退款" : "尚欠"}</dt><dd>{formatMoney(Math.abs(summary.balance))}</dd></div></dl> : summary?.blockedReason ? <p>{summary.blockedReason}</p> : <p>{financeReady ? "帳款未確認，暫無法記錄收款。" : "讀取本單帳款中…"}</p>}
          <div className="dwActions"><AdminButton disabled={blocked || !summary || Boolean(summary.blockedReason) || summary.balance <= 0 || !cashPeriodId} onClick={() => { if (account) setDialog({ kind: "receipt", order, account }); }}>同單收款</AdminButton><Link href={`/admin/orders?${new URLSearchParams({ date: order.sessionBusinessDate || businessDate, session: order.sessionId, order: order.id })}`}>完整點單管理</Link></div>
          {!cashPeriodId && <p>尚未確認收款營業日，請重新整理。</p>}
        </div>
      </article>;
    })}
    {dialog?.kind === "complete" && <WorkbenchItemCompletionDialog order={dialog.order} unit={dialog.unit} onClose={close} onCommitted={committed} onBusy={onBusy} />}
    {dialog?.kind === "receipt" && <WorkbenchOrderReceiptDialog order={dialog.order} account={dialog.account} cashPeriodId={cashPeriodId} businessDate={businessDate} onClose={close} onCommitted={committed} onBusy={onBusy} />}
  </div>;
}
