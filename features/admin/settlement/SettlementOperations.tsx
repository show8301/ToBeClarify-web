import { useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { AdminButton, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { AttendancePanel } from "./AttendancePanel";
import { SettlementStaffInputTable } from "./SettlementStaffInputTable";
import { settlementMoney as money, settlementPeriodStatuses, settlementRoles, settlementStatuses } from "./presentation";
import type { SettlementOverview, SettlementRunFields, SettlementStaff, SettlementStaffInput } from "./types";

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
  onAdd: (staffId: string, role: string) => void;
  onInputChange: (index: number, key: keyof SettlementStaffInput, value: unknown) => void;
  onSave: () => Promise<void>;
  onCalculate: () => Promise<void>;
  onClose: () => Promise<void>;
  onFinalize: () => Promise<void>;
  onReopen: () => Promise<void>;
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

export function SettlementOperations({ overview, inputs, staff, dayType, setDayType, fields, setFields, canManage, active, saving, dirty, flowVersion, onBusyChange, onAdd, onInputChange, onSave, onCalculate, onClose, onFinalize, onReopen, onReview, onViewPerson, children }: Props) {
  const [step, setStep] = useState(0);
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
  const metrics: [string, number][] = [
    ["有效營業額", summary.grossRevenue], ["指名營業額基礎", summary.designatedRevenueBase],
    ["公司營業額", summary.companyRevenue], ["服務生／經理池", summary.serviceManagerPool],
    ["幕後技術池", summary.backstagePool], ["公司收入", summary.companyIncome],
    ["應付薪資", summary.totalPayroll], ["公司補貼尾差", summary.companySubsidy],
  ];
  const next = () => setStep(current => Math.min(current + 1, steps.length - 1));
  const navigation = <div className="adminSettlementStepActions">
    <AdminButton variant="ghost" disabled={saving || step === 0} onClick={() => setStep(current => current - 1)}><ArrowLeft size={16} aria-hidden="true" />上一步</AdminButton>
    <span>步驟 {step + 1} / {steps.length}</span>
    <AdminButton variant="secondary" disabled={saving || step === steps.length - 1} onClick={next}>下一步<ArrowRight size={16} aria-hidden="true" /></AdminButton>
  </div>;

  return <>
    <div className="adminSettlementSectionHeading"><div><h2>營運結算</h2><p>依序關店、核對出勤與金額，再完成正式結算。</p></div><span className="adminSettlementBadge">{settlementStatuses[run.status] || run.status}</span></div>
    {anomalies.length || pending.length || pendingFinance ? <aside className="adminSettlementAttention" aria-label="待處理事項">
      <CircleAlert size={21} aria-hidden="true" />
      <div><strong>結算前需留意</strong><div className="adminSettlementAttentionItems">
        {anomalies.length ? <button type="button" onClick={() => setStep(2)}>結算異常 {anomalies.length} 項</button> : null}
        {pending.length ? <button type="button" onClick={() => setStep(1)}>補打卡待核准 {pending.length} 筆</button> : null}
        {pendingFinance ? <button type="button" onClick={() => setStep(2)}>費用待確認 {pendingFinance} 筆</button> : null}
      </div></div>
    </aside> : null}
    <nav className="adminSettlementStepper" aria-label="營運結算流程">
      {steps.map((item, index) => <button key={item.title} type="button" aria-current={step === index ? "step" : undefined} aria-controls={`settlement-step-panel-${index}`} disabled={saving} onClick={() => setStep(index)}>
        <span className="adminSettlementStepNumber">{complete[index] ? <CircleCheck size={21} aria-label="已完成" /> : index + 1}</span>
        <span><strong>{item.title}</strong><small>{item.description}</small></span>
      </button>)}
    </nav>

    <div id="settlement-step-panel-0" hidden={step !== 0} className="adminSettlementStepBody">
      <AdminPanel title="確認營業狀態" description="先完成關店，再核對仍在服務的訂單。">
        <div className="adminSettlementClosing">
          <div><span>本日營業狀態</span><strong>{period ? settlementPeriodStatuses[period] || period : "尚無營業狀態"}</strong><small>{run.businessDate} · 第 {run.sessionNo} 時段</small></div>
          {canManage && period === "open" ? <AdminButton variant="danger" onClick={() => void onClose()} disabled={saving}>停止新單並完成關店</AdminButton> : null}
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
      <AttendancePanel businessDate={run.businessDate} canManage={canManage} locked={finalized} disabled={saving} active={active && step === 1} onBusyChange={onBusyChange} />
      {pending.length ? <AdminPanel title={`補打卡待核准 · ${pending.length} 筆`} description="活動日出席須有打卡紀錄，補打卡由開發人員或店經理核准。">
        <div className="adminSettlementRequestList">{pending.map(item => <article key={item.id}>
          <div><strong>{item.staffName || item.staffId}</strong><span>{settlementRoles[item.role] || item.role} · {item.requestedMinutes} 分鐘</span><p>{item.reason}</p></div>
          {canManage && !finalized ? <div className="adminSettlementInlineActions"><AdminButton variant="secondary" disabled={saving} onClick={() => void onReview(item.id, true)}>核准</AdminButton><AdminButton variant="ghost" disabled={saving} onClick={() => void onReview(item.id, false)}>拒絕</AdminButton></div> : <span className="adminSettlementBadge">待核准</span>}
        </article>)}</div>
      </AdminPanel> : null}
      <details className="adminSettlementDisclosure">
        <AdminDisclosureSummary>計薪輸入與人員角色 · {inputs.length} 筆</AdminDisclosureSummary>
        <div className="adminSettlementDisclosureBody">
        <p className="adminSettlementHint">全天實際分鐘加總後，以半小時為切點計薪。公共小費名單由核准出勤資料產生。</p>
        <SettlementStaffInputTable inputs={inputs} staff={staff} editable={editable} isEvent={dayType === "event"} onAdd={onAdd} onChange={onInputChange} />
        {canManage && !finalized ? <div className="adminSettlementActionBar"><span>{dirty ? "有尚未保存的結算輸入。" : "核對完成後，在下一步重新計算。"}</span><AdminButton variant="secondary" disabled={saving} onClick={() => void onSave()}>保存結算輸入</AdminButton></div> : null}
      </div></details>
      {navigation}
    </div>

    <div id="settlement-step-panel-2" hidden={step !== 2} className="adminSettlementStepBody">
      <section className="adminSettlementMoneyHero" aria-label="本時段金額摘要">
        <div className="adminSettlementPrimaryAmount"><span>本時段淨實收</span><strong>{netCash == null ? "—" : money(netCash)} <small>G</small></strong><p>已收款扣除已退款</p></div>
        <dl><div><dt>應付薪資</dt><dd>{money(summary.totalPayroll)} G</dd></div><div><dt>公司收入</dt><dd>{money(summary.companyIncome)} G</dd></div><div><dt>分潤保留</dt><dd>{money(retained)} G</dd></div></dl>
      </section>
      {anomalies.length ? <AdminPanel title={`需處理的結算異常 · ${anomalies.length} 項`} description="完成輸入或修正後重新計算，以下異常會阻止正式結算。" className="adminSettlementAnomalies"><ul>{anomalies.map((item, index) => <li key={`${item.code}-${item.sourceId || index}`}>{item.message}{item.sourceId ? `（${item.sourceId}）` : ""}</li>)}</ul></AdminPanel> : null}
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
        {canManage && !finalized ? <div className="adminSettlementActionBar"><span>{dirty ? "輸入尚未保存，請先保存再重新計算。" : "保存輸入後，重新計算最新薪資。"}</span><AdminButton variant="secondary" onClick={() => void onSave()} disabled={saving}>保存輸入</AdminButton><AdminButton onClick={() => void onCalculate()} disabled={saving || dirty}>重新計算預覽</AdminButton></div> : null}
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
      <AdminPanel title={finalized ? "本時段已正式結算" : "確認並完成結算"} description={finalized ? "本時段的結算快照已鎖定，可記錄支付或事後差額。" : "核對本次應付與規則版本後，鎖定此營業時段。"}>
        <div className="adminSettlementFinalTotal"><span>本時段應付薪資</span><strong>{money(summary.totalPayroll)} <small>G</small></strong></div>
        <dl className="adminSettlementDefinitionList"><div><dt>營業日期／時段</dt><dd>{run.businessDate} · 第 {run.sessionNo} 時段</dd></div><div><dt>規則版本</dt><dd>{overview.rule.effectiveFrom} 生效</dd></div><div><dt>營業狀態</dt><dd>{period ? settlementPeriodStatuses[period] || period : "由系統檢查"}</dd></div><div><dt>結算異常</dt><dd>{anomalies.length ? `${anomalies.length} 項待處理` : "無結算異常"}</dd></div><div><dt>計算狀態</dt><dd>{settlementStatuses[run.status] || run.status}</dd></div></dl>
        {dirty ? <p className="adminSettlementInlineWarning">有尚未保存的輸入，請返回金額核對保存並重新計算。</p> : null}
        {!finalized && workflow?.canFinalize === false ? <p className="adminSettlementInlineWarning">目前尚不符合正式結算條件，請依前面步驟處理後重新計算。</p> : null}
        {canManage ? <div className="adminSettlementActionBar"><span>{finalized ? "若繼續營業，可建立新的營業時段。" : "正式結算後，本時段輸入會鎖定。"}</span>{finalized ? <AdminButton variant="secondary" disabled={saving} onClick={() => void onReopen()}>重新開放新時段</AdminButton> : <AdminButton disabled={!canFinalize} onClick={() => void onFinalize()}>確認正式結算</AdminButton>}</div> : null}
      </AdminPanel>
      {finalized && canManage ? children : null}
      {navigation}
    </div>
  </>;
}
