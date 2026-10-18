"use client";

import { useState } from "react";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { WorkbenchShiftBar } from "./WorkbenchShiftBar";
import { ManagerStaffingPanel } from "./ManagerStaffingPanel";
import { WorkbenchManagerRequests } from "./WorkbenchManagerRequests";
import { ManagerBusinessPanel } from "./ManagerBusinessPanel";
import { ManagerBusinessActionDialog } from "./ManagerBusinessActionDialog";
import type { ManagerBusinessAction } from "./ManagerBusinessActionDialog";
import { ManagerTasksPanel, ManagerRoomsPanel } from "./ManagerTasksPanel";
import { ManagerBroadcastPanel } from "./ManagerBroadcastPanel";
import { financeNeedsAttention, ManagerFinancePanel, ManagerSettlementPanel } from "./ManagerFinancePanels";
import { managerOrderRoute, managerSettlementRoute, useManagerOverview } from "./managerOverview";
import { formatDateTime, formatMoney, intakeModeLabel, periodStatusLabel } from "./operationsFormat";
import type { CurrentAdminUser, OperationsAction, OperationsActionState, OperationsData } from "./operationsTypes";

type Props = { data: OperationsData; user?: CurrentAdminUser; navigate: (route: string) => void; runAction: OperationsAction;
  actionState: OperationsActionState; onOpenCreatePass: () => void; onOpenCreateRoomService: () => void; onChanged?: () => Promise<void>; disabled: boolean; staffingBlockedReason?: string };

export function AdminManagerDashboard({ data, user, navigate, actionState, onOpenCreateRoomService, onChanged, disabled, staffingBlockedReason }: Props) {
  const [sessionNo, setSessionNo] = useState(1);
  const [businessAction, setBusinessAction] = useState<{ date: string; action: ManagerBusinessAction } | null>(null);
  const [businessFeedback, setBusinessFeedback] = useState("");
  const overview = useManagerOverview(data, sessionNo);
  const context = data.context;
  const date = context?.referenceBusinessDate || "";
  const settings = overview.settings.data;
  const settlement = overview.settlement.data;
  const workflow = settlement?.workflow;
  const workflowMatches = Boolean(workflow && workflow.periodId === context?.businessPeriodId && workflow.periodStatus === context?.periodStatus);
  const canClose = !disabled && context?.periodStatus === "open" && context.unfinishedOrderCount === 0
    && (!workflowMatches || workflow?.canClose === true && workflow.activeServices === 0);
  const change = async () => { await onChanged?.(); };
  const openBusinessAction = (action: ManagerBusinessAction) => {
    if (!disabled && (action.type !== "close" || canClose)) setBusinessAction({ date, action });
  };
  const financeErrors = overview.finance.filter((entry) => entry.error).length;
  const financeCount = overview.finance.filter((entry) => !entry.error && financeNeedsAttention(entry)).length;
  const activeOrders = data.orders.filter((order) => !["cancelled", "rejected", "expired"].includes(order.status));
  const orderAmount = activeOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const waitingText = disabled ? "確認中" : `${context?.waitingOrderCount ?? 0}／${context?.unfinishedOrderCount ?? 0}`;
  return <div className="adminRoleDashboard adminRoleDashboard-manager managerWorkbench" aria-busy={disabled}>
    <WorkbenchShiftBar businessDate={date} staffId={user?.staffMemberId || ""} name={user?.displayName || "我的出勤"} periodStatus={context?.periodStatus || ""} disabled={disabled || Boolean(actionState.busyId)} onChanged={change} />
    <div className="managerDayHeading"><div><span className="managerEyebrow">DAILY OPERATIONS</span><h2>{date || "讀取營業日…"}</h2><p>{context && !disabled ? `${periodStatusLabel(context.periodStatus)} · ${intakeModeLabel(context.intakeMode)}` : "營業狀態尚未確認"}</p></div><small>資料更新 {data.refreshedAt ? formatDateTime(new Date(data.refreshedAt).toISOString()) : "尚未取得"} · 顯示中每 30 秒同步</small></div>
    <div className="adminRoleDashboardMetrics managerTopMetrics">
      {[{ label: "待處理／未完成", value: waitingText, detail: "本營業日訂單" },
        { label: "目前執勤", value: disabled ? "確認中" : `${data.staff.filter((s) => s.isWorkingToday).length} 人`, detail: "依核准值班時段" },
        { label: "包廂未完成", value: disabled ? "確認中" : `${data.roomOrders.filter((o) => !["completed", "cancelled"].includes(o.status)).length} 筆`, detail: "預約與進行中服務" },
        { label: "帳款待辦顧客", value: overview.loading ? "核對中" : `${financeCount} 位`, detail: financeErrors ? `另有 ${financeErrors} 位帳款無法確認` : "待收、待退與未決案件" }].map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}
    </div>
    {actionState.error && <p className="adminOrderMessage isError" role="alert">{actionState.error}</p>}
    {actionState.message && <p className="adminOrderMessage" role="status">{actionState.message}</p>}
    {businessFeedback && <p className="adminOrderMessage" role="status">{businessFeedback}</p>}
    {overview.settings.error && <p className="adminFormError" role="alert">營運提醒與暫停狀態無法確認：{overview.settings.error}</p>}
    <div className="managerColumns">
      <div className="managerControlStack">
        <div id="manager-business">{context && <ManagerBusinessPanel key={date} context={context} settings={settings} disabled={disabled} canClose={canClose} onAction={openBusinessAction} onChanged={change} />}</div>
        <ManagerBroadcastPanel disabled={disabled} navigate={navigate} />
        <ManagerRoomsPanel data={data} disabled={disabled} navigate={navigate} onCreate={onOpenCreateRoomService} />
      </div>
      <ManagerStaffingPanel key={`${user?.id || ""}:${user?.role || ""}`} blockedReason={staffingBlockedReason} onChanged={change} navigate={navigate} />
    </div>
    <ManagerTasksPanel key={date} data={data} settings={settings} disabled={disabled} navigate={navigate} onChanged={change} />
    {onChanged && <WorkbenchManagerRequests data={data} onChanged={change} />}
    <ManagerFinancePanel data={data} finance={overview.finance} loading={overview.loading || disabled} navigate={navigate} />
    <ManagerSettlementPanel data={data} settlement={disabled ? null : settlement} loading={overview.settlementLoading || disabled} error={overview.settlement.error} sessionNo={sessionNo} onSessionChange={setSessionNo} navigate={navigate} canClose={canClose} onCloseBusiness={() => openBusinessAction({ type: "close" })} />
    <AdminPanel title={<span className="adminFieldHeading">今日營運摘要<AdminHelp title="今日營運摘要說明">訂單應付與實際金流分開呈現；有效訂單排除取消、退回與失效訂單，金流依 API 結算口徑。</AdminHelp></span>}>
      <p className="managerHint">營業日 {date || "尚未取得"}</p>
      <div className="managerSummaryGrid">
        <div><span>有效訂單／已完成</span><strong>{disabled ? "確認中" : `${activeOrders.length}／${activeOrders.filter((o) => o.status === "completed").length}`}</strong><small>排除取消、退回與失效訂單</small></div>
        <div><span>有效訂單應付</span><strong>{disabled ? "確認中" : formatMoney(orderAmount)}</strong><small>目前載入訂單的應付金額，未含另登費用</small></div>
        <div><span>本營業日實收／實退</span><strong>{!disabled && workflowMatches ? `${formatMoney(workflow?.cashReceived)}／${formatMoney(workflow?.cashRefunded)}` : "尚未確認"}</strong><small>依 API 結算金流口徑</small></div>
        <div><span>本營業日淨實收</span><strong>{!disabled && workflowMatches ? formatMoney(workflow?.netCash) : "尚未確認"}</strong><small>實收扣除實退，分潤另依保留款計算</small></div>
      </div>
      <div className="adminRoleDashboardQuickLinks"><AdminButton variant="secondary" onClick={() => navigate(managerOrderRoute(date))}>查看完整營運與訂單</AdminButton><AdminButton variant="ghost" onClick={() => navigate(managerSettlementRoute(date, sessionNo))}>查看營收與薪資明細</AdminButton></div>
    </AdminPanel>
    {context && businessAction?.date === date && <ManagerBusinessActionDialog
      key={`${date}:${businessAction.action.type}`}
      context={context}
      action={businessAction.action}
      disabled={disabled}
      onClose={() => setBusinessAction(null)}
      onCompleted={async (message) => {
        setBusinessFeedback(message);
        setBusinessAction(null);
        await change();
      }}
    />}
  </div>;
}
