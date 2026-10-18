import { useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { AdminButton, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { AttendancePanel } from "./AttendancePanel";
import { SettlementStaffInputTable } from "./SettlementStaffInputTable";
import { SettlementAnomalies } from "./SettlementAnomalies";
import { settlementMoney as money, settlementPeriodStatuses, settlementRoles, settlementStatuses } from "./presentation";
import type { SettlementOverview, SettlementRunFields, SettlementStaff, SettlementStaffInput } from "./types";
import { getFinalizeDisabledReason } from "./disabled-reasons";
import { SettlementRecalculation } from "./SettlementRecalculation";

type Props = {
  overview: SettlementOverview;
  inputs: SettlementStaffInput[];
  staff: SettlementStaff[];
  dayType: string;
  setDayType: (value: string) => void;
  fields: SettlementRunFields;
  setFields: Dispatch<SetStateAction<SettlementRunFields>>;
  canManage: boolean;
  active: boolean;
  saving: boolean;
  dirty: boolean;
  flowVersion: number;
  onBusyChange: (busy: boolean) => void;
  onAttendanceChanged: () => Promise<boolean>;
  onRemove: (index: number) => void;
  onAdd: (staffId: string, role: string) => void;
  onInputChange: (index: number, key: keyof SettlementStaffInput, value: unknown) => void;
  onSave: () => Promise<void>;
  onCalculate: () => Promise<void>;
  onClose: () => Promise<void>;
  onFinalize: () => Promise<void>;
  onRecalculated: () => Promise<boolean>;
  onReview: (requestId: string, approved: boolean) => void;
  onViewPerson: (staffId: string) => void;
  children?: ReactNode;
};

const steps = [
  { title: "關店確認", description: "訂單與服務狀態" },
  { title: "出勤核對", description: "工時與補打卡" },
  { title: "金額核對", description: "實收、薪資與小費" },
  { title: "正式結算", description: "確認並鎖定時段" },
];

export function SettlementOperations({ overview, inputs, staff, dayType, setDayType, fields, setFields, canManage, active, saving, dirty, flowVersion, onBusyChange, onAttendanceChanged, onRemove, onAdd, onInputChange, onSave, onCalculate, onClose, onFinalize, onRecalculated, onReview, onViewPerson, children }: Props) {
  const [step, setStep] = useState(0);
  const [inputsOpen, setInputsOpen] = useState(false);
  type Action = "close" | "save" | "calculate" | "finalize";
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const actionLock = useRef<Action | null>(null);
  const { run, summary, workflow, anomalies } = overview;
  const finalized = run.status === "finalized";
  const editable = canManage && !finalized && !saving;
  const pending = (overview.attendanceBackfillRequests || []).filter(item => item.status === "pending");
  const pendingFinance = workflow?.pendingFinanceCount ?? summary.pendingFinanceCount ?? 0;
  const netCash = workflow?.netCash ?? summary.netCash;
  const retained = workflow?.retainedAmount ?? summary.retainedAmount ?? 0;
  const period = workflow?.periodStatus;
  const closed = period === "closed" || period === "settled";
  const complete = [closed, false, run.status === "calculated" || finalized, finalized];
  const canFinalize = canManage && !saving && !dirty && !finalized && !anomalies.length && workflow?.canFinalize !== false;
  const finalizeReason = pendingAction === "finalize" ? "正在完成正式結算，請勿重複送出。"
    : getFinalizeDisabledReason({ canManage, saving, dirty, finalized, anomalyCount: anomalies.length, workflow });
  const runAction = async (action: Action, operation: () => Promise<void>) => {
    if (saving || actionLock.current || (action === "finalize" && !canFinalize)) return;
    actionLock.current = action;
    setPendingAction(action);
    try { await operation(); }
    finally { actionLock.current = null; setPendingAction(null); }
  };
  const metrics: [string, number][] = [
    ["有效營業額", summary.grossRevenue], ["指名營業額基礎", summary.designatedRevenueBase],
    ["公司營業額", summary.companyRevenue], ["服務生／經理池", summary.serviceManagerPool],
    ["幕後技術池", summary.backstagePool], ["公司收入", summary.companyIncome],
    ["應付薪資", summary.totalPayroll], ["公司補貼尾差", summary.companySubsidy],
  ];
  const changeStep = (nextStep: number) => {
    if (saving) return;
    setStep(nextStep);
    if (nextStep === 2) void onAttendanceChanged();
  };
  const next = () => changeStep(Math.min(step + 1, steps.length - 1));
  const navigation = <div className="adminSettlementStepActions">
    <AdminButton variant="ghost" disabled={saving || step === 0} onClick={() => changeStep(step - 1)}><ArrowLeft size={16} aria-hidden="true" />上一步</AdminButton>
    <span>步驟 {step + 1} / {steps.length}</span>
    <AdminButton variant="secondary" disabled={saving || step === steps.length - 1} onClick={next}>下一步<ArrowRight size={16} aria-hidden="true" /></AdminButton>
  </div>;

  return <>
    <div className="adminSettlementSectionHeading"><div><h2>營運結算</h2><p>依序關店、核對出勤與金額，再完成正式結算。</p></div><span className="adminSettlementBadge">{settlementStatuses[run.status] || run.status}</span></div>
    {anomalies.length || pending.length || pendingFinance ? <aside className="adminSettlementAttention" aria-label="待處理事項">
      <CircleAlert size={21} aria-hidden="true" />
      <div><strong>結算前需留意</strong><div className="adminSettlementAttentionItems">
        {anomalies.length ? <button type="button" disabled={saving} onClick={() => changeStep(2)}>結算異常 {anomalies.length} 項</button> : null}
        {pending.length ? <button type="button" disabled={saving} onClick={() => changeStep(1)}>補打卡待核准 {pending.length} 筆</button> : null}
      {pendingFinance ? <details className="adminSettlementFinanceDisclosure">
        <AdminDisclosureSummary>費用待確認 {pendingFinance} 筆</AdminDisclosureSummary>
        <div className="adminSettlementFinanceDisclosureBody">
          <p>開啟相關顧客帳單，逐筆核對並更正費用紀錄。</p>
          {workflow?.pendingFinanceItems?.length ? <ul>
            {workflow.pendingFinanceItems.map(item => {
              const query = new URLSearchParams({ date: run.businessDate, session: item.sessionId });
              if (item.orderId) query.set("order", item.orderId);
              const orderLabel = item.orderNumber || (item.orderId ? `訂單 ${item.orderId}` : "未連結訂單帳款");
              return <li key={`${item.sessionId}-${item.orderId || "session"}`}>
                <a href={`/admin/orders?${query.toString()}`} target="_blank" rel="noopener noreferrer">
                  {item.customerName || "未命名顧客"} · {orderLabel}
                </a>
                <span>{item.pendingRecordCount} 筆待確認</span>
              </li>;
            })}
          </ul> : <p role="status">此版本尚未提供逐筆費用清單，請前往金額核對查看。</p>}
          <button type="button" disabled={saving} onClick={() => changeStep(2)}>前往金額核對</button>
        </div>
      </details> : null}
      </div></div>
    </aside> : null}
    <nav className="adminSettlementStepper" aria-label="營運結算流程">
      {steps.map((item, index) => <button key={item.title} type="button" aria-current={step === index ? "step" : undefined} aria-controls={`settlement-step-panel-${index}`} disabled={saving} onClick={() => changeStep(index)}>
        <span className="adminSettlementStepNumber">{complete[index] ? <CircleCheck size={21} aria-label="已完成" /> : index + 1}</span>
        <span><strong>{item.title}</strong><small>{item.description}</small></span>
      </button>)}
    </nav>

    <div id="settlement-step-panel-0" hidden={step !== 0} className="adminSettlementStepBody">
      <AdminPanel title="確認營業狀態" description="先完成關店，再核對仍在服務的訂單。">
        <div className="adminSettlementClosing">
          <div><span>本日營業狀態</span><strong>{period ? settlementPeriodStatuses[period] || period : "尚無營業狀態"}</strong><small>{run.businessDate} · 第 {run.sessionNo} 時段</small></div>
          {canManage && period === "open" ? <AdminButton variant="danger" busy={pendingAction === "close"} busyLabel="關店處理中…" onClick={() => void runAction("close", onClose)} disabled={saving}>停止新單並完成關店</AdminButton> : null}
        </div>
        <div className="adminSettlementSummary">
          <div><span>未完成訂單</span><strong>{workflow?.unfinishedOrderCount ?? "—"} <small>筆</small></strong></div>
          <div><span>仍在服務</span><strong>{workflow?.activeServiceCount ?? "—"} <small>筆</small></strong></div>
          <div><span>已收款</span><strong>{money(workflow?.cashReceived ?? summary.cashReceived ?? 0)} G</strong></div>
          <div><span>已退款</span><strong>{money(workflow?.cashRefunded ?? summary.cashRefunded ?? 0)} G</strong></div>
        </div>
        {workflow?.unfinishedOrderCount ? <p className="adminSettlementInlineWarning">仍有未完成訂單，請至訂單工作台完成服務或登記實際終止。</p> : null}
        {flowVersion >= 2 ? <p className="adminSettlementHint">現場收退款與結算後差額納入同一營業日；未決金額依系統規則保留分潤並可跨日結轉。</p> : null}
      </AdminPanel>
      {navigation}
    </div>

    <div id="settlement-step-panel-1" hidden={step !== 1} className="adminSettlementStepBody">
      <AttendancePanel businessDate={run.businessDate} canManage={canManage} locked={finalized} disabled={saving} active={active && step === 1} onBusyChange={onBusyChange} onChanged={onAttendanceChanged} />
      {pending.length ? <AdminPanel title={`補打卡待核准 · ${pending.length} 筆`} description="活動日出席須有打卡紀錄，補打卡由開發人員或店經理核准。">
        <div className="adminSettlementRequestList">{pending.map(item => <article key={item.id}>
          <div><strong>{item.staffName || item.staffId}</strong><span>{settlementRoles[item.role] || item.role} · {item.requestedMinutes} 分鐘</span><p>{item.reason}</p></div>
          {canManage && !finalized ? <div className="adminSettlementInlineActions"><AdminButton variant="secondary" disabled={saving} onClick={() => void onReview(item.id, true)}>核准</AdminButton><AdminButton variant="ghost" disabled={saving} onClick={() => void onReview(item.id, false)}>拒絕</AdminButton></div> : <span className="adminSettlementBadge">待核准</span>}
        </article>)}</div>
      </AdminPanel> : null}
      <details className="adminSettlementDisclosure" open={inputsOpen} onToggle={event => setInputsOpen(event.currentTarget.open)}>
        <AdminDisclosureSummary>計薪輸入與人員角色 · {inputs.length} 筆</AdminDisclosureSummary>
        <div className="adminSettlementDisclosureBody">
        <p className="adminSettlementHint">有效出勤沿用現有時數換算，依上班開始時鎖定的單一職位計薪。支援不改主要職位公式，額外服務分潤另計；幕後參與僅限開發人員。舊輸入若與鎖定職位衝突，請先核對再移除，保存時保留異動紀錄。</p>
        <SettlementStaffInputTable inputs={inputs} staff={staff} assignments={overview.payrollAssignments || []} onRemove={onRemove} editable={editable} isEvent={dayType === "event"} onAdd={onAdd} onChange={onInputChange} />
        {canManage && !finalized ? <div className="adminSettlementActionBar"><span>{dirty ? "有尚未保存的結算輸入。" : "核對完成後，在下一步重新計算。"}</span><AdminButton variant="secondary" disabled={saving} onClick={() => void onSave()}>保存結算輸入</AdminButton></div> : null}
      </div></details>
      {navigation}
    </div>

    <div id="settlement-step-panel-2" hidden={step !== 2} className="adminSettlementStepBody">
      <section className="adminSettlementMoneyHero" aria-label="本時段金額摘要">
        <div className="adminSettlementPrimaryAmount"><span>本時段淨實收</span><strong>{netCash == null ? "—" : money(netCash)} <small>G</small></strong><p>已收款扣除已退款</p></div>
        <dl><div><dt>應付薪資</dt><dd>{money(summary.totalPayroll)} G</dd></div><div><dt>公司收入</dt><dd>{money(summary.companyIncome)} G</dd></div><div><dt>分潤保留</dt><dd>{money(retained)} G</dd></div></dl>
      </section>
      <SettlementAnomalies overview={overview} staff={staff} saving={saving} onRefresh={onAttendanceChanged} onAttendance={() => { setInputsOpen(true); setStep(1); }} />
      {pendingFinance ? <p className="adminSettlementInlineWarning">有 {pendingFinance} 筆費用待確認；已發生金流列入淨實收，受影響分潤保留。</p> : null}
      <AdminPanel title="核對本日輸入" description="確認公共小費與入場費；活動日會顯示活動分配欄位。">
        <div className="adminFormGrid">
          <AdminField label="日期類型"><select value={dayType} disabled={!editable || run.status !== "draft"} onChange={event => setDayType(event.target.value)}><option value="normal">非活動日</option><option value="event">活動日</option></select></AdminField>
          <AdminField label="公共小費" hint="不包含指定店員小費。"><input type="number" min="0" value={fields.publicTipAmount} disabled={!editable} onChange={event => setFields(current => ({ ...current, publicTipAmount: Number(event.target.value) || 0 }))} /></AdminField>
          <AdminField label="入場費覆寫" hint="留白時沿用啟用中的入場費。"><input type="number" min="0" value={fields.admissionFeeOverride} disabled={!editable} onChange={event => setFields(current => ({ ...current, admissionFeeOverride: event.target.value }))} /></AdminField>
          {dayType === "event" ? <>
            <AdminField label="活動費用"><input type="number" min="0" value={fields.activityExpense} disabled={!editable} onChange={event => setFields(current => ({ ...current, activityExpense: Number(event.target.value) || 0 }))} /></AdminField>
            <AdminField label="公司份額時數" hint="個人分配時數可在出勤核對中調整。"><input type="number" min="0" step="0.5" value={fields.companyShareHours} disabled={!editable} onChange={event => setFields(current => ({ ...current, companyShareHours: event.target.value }))} /></AdminField>
          </> : null}
        </div>
        {dayType === "event" ? <label className="adminSettlementConfirm"><input type="checkbox" checked={fields.activityHoursConfirmed} disabled={!editable} onChange={event => setFields(current => ({ ...current, activityHoursConfirmed: event.target.checked }))} />我已確認個人分配時數與公司份額時數。</label> : null}
        {canManage && !finalized ? <div className="adminSettlementActionBar"><span>{dirty ? "輸入尚未保存，請先保存再重新計算。" : "保存輸入後，重新計算最新薪資。"}</span><AdminButton variant="secondary" busy={pendingAction === "save"} busyLabel="儲存中…" onClick={() => void runAction("save", onSave)} disabled={saving}>保存輸入</AdminButton><AdminButton busy={pendingAction === "calculate"} busyLabel="計算中…" disabledReason={dirty ? "請先保存輸入，再重新計算預覽。" : undefined} onClick={() => void runAction("calculate", onCalculate)} disabled={saving || dirty}>重新計算預覽</AdminButton></div> : null}
      </AdminPanel>
      <details className="adminSettlementDisclosure">
        <AdminDisclosureSummary>營業額與分潤明細</AdminDisclosureSummary>
        <div className="adminSettlementDisclosureBody">
          <div className="adminSettlementSummary">{metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value)} G</strong></div>)}</div>
        </div>
      </details>
      <details className="adminSettlementDisclosure">
        <AdminDisclosureSummary>全員薪資預覽 · {overview.results.length} 筆</AdminDisclosureSummary>
        <div className="adminSettlementDisclosureBody">
          <div className="adminSettlementTableWrap">
            <table className="adminSettlementTable">
              <thead><tr><th>人員</th><th>角色</th><th className="adminSettlementNumber">應付薪資</th><th>異常</th><th>個人帳目</th></tr></thead>
              <tbody>{overview.results.map((item, index) => <tr key={`${item.staffId || "company"}-${item.role}-${index}`}>
                <td>{item.displayName || item.staffId || "公司"}</td>
                <td>{settlementRoles[item.role] || item.role}</td>
                <td className="adminSettlementNumber"><strong>{money(item.afterRounding)} G</strong></td>
                <td>{item.anomalyStatus !== "normal" ? item.anomalyNote || item.anomalyStatus : "—"}</td>
                <td>{item.staffId ? <AdminButton variant="ghost" onClick={() => onViewPerson(item.staffId!)}>查看明細</AdminButton> : "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      </details>
      {navigation}
    </div>

    <div id="settlement-step-panel-3" hidden={step !== 3} className="adminSettlementStepBody">
      <AdminPanel title={finalized ? "本時段已正式結算" : "確認並完成結算"} description={finalized ? "目前正式結算可記錄支付、事後差額，或於資料補正後建立新的結算版本。" : "核對本次應付與規則版本後，鎖定此營業時段。"}>
        <div className="adminSettlementFinalTotal"><span>本時段應付薪資</span><strong>{money(summary.totalPayroll)} <small>G</small></strong></div>
        <dl className="adminSettlementDefinitionList"><div><dt>營業日期／時段</dt><dd>{run.businessDate} · 第 {run.sessionNo} 時段</dd></div><div><dt>規則版本</dt><dd>{overview.rule.effectiveFrom} 生效</dd></div><div><dt>營業狀態</dt><dd>{period ? settlementPeriodStatuses[period] || period : "由系統檢查"}</dd></div><div><dt>結算異常</dt><dd>{anomalies.length ? `${anomalies.length} 項待處理` : "無結算異常"}</dd></div><div><dt>計算狀態</dt><dd>{settlementStatuses[run.status] || run.status}</dd></div></dl>
        {!finalized && finalizeReason ? <p id="settlement-finalize-reason" className="adminSettlementInlineWarning" role="status">{finalizeReason}</p> : null}
        {canManage ? <div className="adminSettlementActionBar"><span>{finalized ? "出勤或帳款補正後，可核對差額並建立新的結算版本。" : "正式結算後，本時段輸入會鎖定。"}</span>{!finalized ? <AdminButton busy={pendingAction === "finalize"} busyLabel="結算中…" disabledReason={finalizeReason} aria-describedby={finalizeReason ? "settlement-finalize-reason" : undefined} disabled={!canFinalize} onClick={() => void runAction("finalize", onFinalize)}>確認正式結算</AdminButton> : null}</div> : null}
        {finalized && canManage ? <SettlementRecalculation run={run} saving={saving} onBusyChange={onBusyChange} onRecalculated={onRecalculated} /> : null}
      </AdminPanel>
      {finalized && canManage ? children : null}
      {navigation}
    </div>
  </>;
}
