"use client";

import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { formatMoney } from "./operationsFormat";
import { managerOrderRoute, managerSettlementRoute } from "./managerOverview";
import type { ManagerFinance, ManagerSettlement } from "./managerOverview";
import type { OperationsData } from "./operationsTypes";

const caseLabels: Record<string, string> = {
  unpaid: "尚未收款", pending_allocation: "款項待歸屬", pending_refund: "待退款", refund_due: "待退款",
};

export function financeNeedsAttention(item: ManagerFinance) {
  const account = item.account;
  return Boolean(item.error || account && account.flowVersion >= 2 && (account.balance > 0 || account.refundDue > 0
    || account.pendingCount > 0 || account.holdScope !== "none" || account.balanceIsProvisional || item.cases.some((c) => c.status === "open")));
}

export function ManagerFinancePanel({ data, finance, loading, navigate }: {
  data: OperationsData; finance: ManagerFinance[]; loading: boolean; navigate: (route: string) => void;
}) {
  const date = data.context?.referenceBusinessDate || "";
  const entries = finance.filter(financeNeedsAttention);
  const legacy = finance.filter((item) => item.account && item.account.flowVersion < 2).length;
  return <AdminPanel title={<span className="adminFieldHeading">帳款待辦<AdminHelp title="帳款待辦說明">核對待收、待退、款項歸屬與分潤保留；加收、折讓及實際收退款由顧客明細處理。</AdminHelp></span>} actions={<AdminButton variant="secondary" onClick={() => navigate(managerOrderRoute(date))}>登記費用／收退款</AdminButton>}>
    {loading && <p role="status">正在核對本營業日顧客帳款…</p>}
    {legacy > 0 && <p className="managerHint">有 {legacy} 位顧客沿用舊版流程，請至完整點單管理核對。</p>}
    <div className="managerQueue">{entries.map((item) => {
      const customer = data.sessions.find((s) => s.id === item.sessionId);
      const account = item.account;
      return <article key={item.sessionId} className="managerTask">
        <div className="managerTaskIdentity"><strong>{customer?.customerName || "未命名顧客"}</strong><small>ID {customer?.gameId || "—"}</small>{account?.businessDate !== date && account && <small>原營業日 {account.businessDate}</small>}</div>
        <div className="managerTaskCopy">
          {item.error ? <p className="adminFormError" role="alert">帳款無法確認：{item.error}</p> : account && <>
            <strong>{account.balance > 0 ? `待收 ${formatMoney(account.balance)}` : account.refundDue > 0 ? `待退 ${formatMoney(account.refundDue)}` : "款項／歸屬待確認"}{account.balanceIsProvisional ? "（暫計）" : ""}</strong>
            <small>待確認 {account.pendingCount} 筆{account.holdScope !== "none" ? " · 分潤保留中" : ""}</small>
            {item.cases.filter((c) => c.status === "open").map((c) => <small key={c.id}>{caseLabels[c.caseKind] || "未決案件"} · {c.description} · {formatMoney(c.amount)}</small>)}
          </>}
        </div>
        <AdminButton variant="secondary" onClick={() => navigate(managerOrderRoute(date, item.sessionId))}>核對此顧客帳款</AdminButton>
      </article>;
    })}{!loading && !entries.length && <p className="adminRoleDashboardEmpty">目前已取得的分項帳款沒有待辦。</p>}</div>
  </AdminPanel>;
}

type SettlementProps = { data: OperationsData; settlement: ManagerSettlement | null; loading: boolean; error: string; sessionNo: number; onSessionChange: (value: number) => void; navigate: (route: string) => void; canClose: boolean; onCloseBusiness: () => void };

export function ManagerSettlementPanel({ data, settlement, loading, error, sessionNo, onSessionChange, navigate, canClose, onCloseBusiness }: SettlementProps) {
  const context = data.context;
  const date = context?.referenceBusinessDate || "";
  const workflow = settlement?.workflow;
  const workflowMatches = Boolean(workflow && workflow.periodId === context?.businessPeriodId && workflow.periodStatus === context?.periodStatus);
  const finalized = settlement?.status === "finalized";
  const pending = workflow?.pending;
  const unresolved = workflow?.unfinished;
  const serviceCount = workflow?.activeServices;
  const checks = [
    { title: "停止顧客新單", detail: context?.intakeMode === "staff_only" || context?.periodStatus === "closed" || context?.periodStatus === "settled" ? "已停止顧客自行下單" : "請先切換僅店員接單，再完成收尾", done: context?.intakeMode === "staff_only" || context?.periodStatus === "closed" || context?.periodStatus === "settled", unknown: !context },
    { title: "訂單與服務收尾", detail: workflowMatches ? `未完成 ${unresolved} 張 · 進行中服務 ${serviceCount} 筆` : "尚未取得此營業期的完整履約檢核", done: workflowMatches && unresolved === 0 && serviceCount === 0, unknown: !workflowMatches },
    { title: "實際關店", detail: context?.periodStatus === "closed" || context?.periodStatus === "settled" ? "已完成關店" : "完成訂單與服務收尾後，在此確認實際關店", done: context?.periodStatus === "closed" || context?.periodStatus === "settled", unknown: !context },
    { title: "帳款與分潤核對", detail: workflowMatches ? `待確認 ${pending} 筆 · 保留 ${formatMoney(workflow?.retained)}` : "請進入結算工作臺核對實收與保留款", done: workflowMatches && pending === 0 && workflow?.retained === 0, unknown: !workflowMatches },
    { title: "工時與薪資核對", detail: settlement ? `結算異常 ${settlement.anomalies.length} 項；請在結算工作臺核對工時、薪資與小費` : "尚未取得結算檢核", done: finalized, unknown: !settlement },
    { title: "正式結算", detail: finalized ? `第 ${sessionNo} 時段已正式結算` : workflowMatches && workflow?.canFinalize && !settlement?.anomalies.length ? "可進入結算工作臺確認正式結算" : "請完成關店與異常核對，再進入正式結算", done: finalized, unknown: !settlement },
  ];
  return <AdminPanel title={<span className="adminFieldHeading">收班與正式結算<AdminHelp title="收班與正式結算說明">關店、帳款、工時與正式結算分開追蹤；最終可否結算仍以 API 檢核為準。</AdminHelp></span>} actions={<AdminButton disabled={!date} onClick={() => navigate(managerSettlementRoute(date, sessionNo))}>核對並完成正式結算</AdminButton>}>
    <div className="managerInlineForm"><label className="managerSessionField">結算時段<input type="number" min={1} max={2147483647} step={1} value={sessionNo} onChange={(event) => { const value = Number(event.target.value); if (Number.isSafeInteger(value) && value > 0 && value <= 2147483647) onSessionChange(value); }} /></label><span className="managerHint">營業日 {date || "尚未取得"} · 第 {sessionNo} 時段</span></div>
    {loading && <p role="status">正在讀取結算與收班檢核…</p>}
    {error && <p className="adminFormError" role="alert">結算無法確認：{error}</p>}
    <ol className="managerChecklist">{checks.map((check, index) => <li key={check.title} className={check.unknown ? "isUnknown" : check.done ? "isDone" : "isPending"}>
      <span className="managerCheckIndex" aria-hidden="true">{check.done ? "✓" : index + 1}</span><div><strong>{check.title}<span className="managerCheckState">{check.unknown ? "待確認" : check.done ? "已完成" : "待處理"}</span></strong><p>{check.detail}</p>
        {check.title === "實際關店" && context?.periodStatus === "open" && <div className="managerChecklistActions">
          <AdminButton variant="danger" disabled={!canClose} disabledReason={!canClose ? "請先完成未結束的訂單與服務，並確認最新營業狀態。" : undefined} onClick={onCloseBusiness}>實際關店</AdminButton>
        </div>}
      </div>
    </li>)}</ol>
    {settlement && <div className="managerSettlementAmounts"><div><span>{finalized ? "已結算應付薪資" : "即時試算應付薪資"}</span><strong>{formatMoney(settlement.payroll)}</strong></div><div><span>{finalized ? "已結算公司收入" : "試算公司收入"}</span><strong>{formatMoney(settlement.companyIncome)}</strong></div></div>}
    {settlement && settlement.anomalies.length > 0 && <details className="managerAnomalies"><summary>需處理的結算異常 · {settlement.anomalies.length} 項</summary><ul>{settlement.anomalies.map((message, index) => <li key={`${index}:${message}`}>{message}</li>)}</ul></details>}
    <p className="managerHint">工時、薪資、小費、香檳塔分潤及活動費用請於結算工作臺核對；保留款與未決案件依既有結算規則處理。</p>
  </AdminPanel>;
}
