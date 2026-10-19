import { AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import type { SettlementResult, SettlementResultSource, SettlementRun, SettlementStaff, SettlementStaffInput, SettlementSummary } from "./types";
import { settlementMoney as money, settlementRoles } from "./presentation";

type Props = {
  staff: SettlementStaff[];
  selectedId: string;
  results: SettlementResult[];
  inputs: SettlementStaffInput[];
  run: SettlementRun;
  summary: SettlementSummary;
  canManage: boolean;
  finalized: boolean;
  saving: boolean;
  onSelect: (id: string) => void;
};

const exactMoney = (value: number) => Number(value || 0).toLocaleString("zh-TW", { maximumFractionDigits: 2 });
const attendanceSourceLabels: Record<SettlementStaffInput["attendanceSource"], string> = {
  clock: "打卡紀錄",
  backfill_approved: "已核准補打卡",
  manual: "手動登錄",
};

function OrderSources({ sources, kind }: { sources: SettlementResultSource[]; kind: SettlementResultSource["kind"] }) {
  const rows = sources.filter((source) => source.kind === kind);
  if (!rows.length) return <p className="adminSettlementHint">沒有此項目的逐筆訂單來源。</p>;

  return <ul className="adminSettlementSourceOrders">
    {rows.map((source, index) => <li key={`${source.orderId}-${source.label}-${index}`}>
      <div>
        <a href={`/admin/notifications/orders/${encodeURIComponent(source.orderId)}`} target="_blank" rel="noopener noreferrer">
          {source.orderNumber || `未提供單號（${source.orderId}）`}
        </a>
        <span>{source.label} · {exactMoney(source.basisAmount)} G × {exactMoney(source.percentage)}%</span>
      </div>
      <strong>{exactMoney(source.amount)} G</strong>
    </li>)}
  </ul>;
}

function SourceDetails({ item, inputs, run, summary, finalized }: {
  item: SettlementResult;
  inputs: SettlementStaffInput[];
  run: SettlementRun;
  summary: SettlementSummary;
  finalized: boolean;
}) {
  const input = inputs.find((candidate) => candidate.staffId === item.staffId && candidate.role === item.role);
  const sources = item.sources || [];
  const revenueSources = sources.filter((source) => source.kind === "designated_revenue");
  const tipSources = sources.filter((source) => source.kind === "designated_tip");
  const serviceManagerInputs = inputs.filter((candidate) => candidate.role === "service" || candidate.role === "manager");
  const serviceManagerHours = serviceManagerInputs.reduce((total, candidate) => total + candidate.payableHours, 0);
  const publicTipInputs = inputs.filter((candidate) => candidate.publicTipEligible
    && ["designated", "service", "manager"].includes(candidate.role) && candidate.payableHours > 0);
  const publicTipHours = publicTipInputs.reduce((total, candidate) => total + candidate.payableHours, 0);
  const activityHours = inputs.reduce((total, candidate) => total + (candidate.activityHours || 0), 0);
  const activityDenominator = activityHours + (run.companyShareHours || 0);
  const publicTipShare = "依本時段公共小費池按符合資格的計薪時數比例分配。";

  return <div className="adminSettlementSourceDetails">
    <section>
      <h4>底薪來源</h4>
      {item.basePay > 0
        ? <p>{input ? `${attendanceSourceLabels[input.attendanceSource]} · 實際 ${input.actualMinutes} 分鐘 · ` : "結算計薪快照 · "}
          {exactMoney(item.payableHours)} 小時 × {exactMoney(item.hourlyRate)} G／小時 = <strong>{exactMoney(item.basePay)} G</strong></p>
        : <p>本項沒有底薪。</p>}
    </section>

    <section>
      <h4>營收分成來源</h4>
      {item.role === "designated" && run.dayType !== "event" ? <>
        {!item.sourceDetailsSnapshotted && finalized && item.revenueShare > 0
          ? <p>這筆既有結算尚未保存逐單來源快照，無法安全還原當時的訂單明細。</p>
          : revenueSources.length
            ? <OrderSources sources={revenueSources} kind="designated_revenue" />
            : <p>本時段沒有指名營收分成來源。</p>}
      </> : run.dayType === "event"
        ? <p>活動日分配為活動收入池按個人活動時數分配：收入池 {exactMoney(summary.activityNetRevenue)} G × 本人 {exactMoney(input?.activityHours || 0)} 小時 ÷ 合計 {exactMoney(activityDenominator)} 小時 = {exactMoney(item.revenueShare)} G；不歸屬到單筆訂單。</p>
        : item.role === "service" || item.role === "manager"
          ? <p>服務員／經理共用分潤池 {exactMoney(summary.serviceManagerPool)} G × 本人 {exactMoney(item.payableHours)} 小時 ÷ 合計 {exactMoney(serviceManagerHours)} 小時 = <strong>{exactMoney(item.revenueShare)} G</strong>。此為工時分攤，不逐項列個人訂單。</p>
          : item.revenueShare > 0
            ? <p>營收基礎 {exactMoney(item.revenueBase)} G × {exactMoney(item.revenuePercentage)}% = <strong>{exactMoney(item.revenueShare)} G</strong>。此角色第一階段不展開逐單來源。</p>
            : <p>本項沒有營收分成。</p>}
    </section>

    <section>
      <h4>指定小費來源</h4>
      {item.designatedTip > 0
        ? (item.role === "service" || item.role === "manager")
          ? <p>本階段不展開服務員／經理的逐筆小費訂單；此金額已納入個人小費合計。</p>
          : !item.sourceDetailsSnapshotted && finalized
          ? <p>這筆既有結算尚未保存逐單小費來源快照。</p>
          : <OrderSources sources={tipSources} kind="designated_tip" />
        : <p>本項沒有指定小費。</p>}
    </section>

    <section>
      <h4>公共小費來源</h4>
      {item.publicTip > 0
        ? <p>{publicTipShare} 公共小費池 {exactMoney(run.publicTipAmount)} G × 本人 {exactMoney(item.payableHours)} 小時 ÷ 合計 {exactMoney(publicTipHours)} 小時 = <strong>{exactMoney(item.publicTip)} G</strong></p>
        : <p>本項沒有公共小費。</p>}
    </section>

    <p className="adminSettlementSourcePayFormula">
      {item.role === "designated" ? "指名薪資取底薪與營收分成較高者" : item.role === "service" || item.role === "manager" ? "服務員／經理薪資為底薪加營收分成" : "依此職位的計薪規則"}：
      {exactMoney(item.preferredPay)} G + 指定小費 {exactMoney(item.designatedTip)} G + 公共小費 {exactMoney(item.publicTip)} G
      = 捨入前 {exactMoney(item.beforeRounding)} G；應付 {money(item.afterRounding)} G。
    </p>
  </div>;
}

export function SettlementPersonalAccounts({ staff, selectedId, results, inputs, run, summary, canManage, finalized, saving, onSelect }: Props) {
  const member = staff.find((item) => item.id === selectedId);
  const personalResults = results.filter((item) => item.staffId === selectedId);
  const personalInputs = inputs.filter((item) => item.staffId === selectedId);
  const total = personalResults.reduce((sum, item) => sum + item.afterRounding, 0);
  const publicTips = personalResults.reduce((sum, item) => sum + item.publicTip, 0);
  const designatedTips = personalResults.reduce((sum, item) => sum + item.designatedTip, 0);

  return (
    <>
      <div className="adminSettlementSectionHeading">
        <div><h2>個人帳目</h2><p>集中核對個人的工時、薪資與小費。</p></div>
        {canManage ? <AdminField label="查看人員"><select value={selectedId} disabled={saving} onChange={(event) => onSelect(event.target.value)}><option value="" disabled>選擇人員</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></AdminField> : null}
      </div>
      {member ? (
        <section className="adminSettlementPersonalHero" aria-label={`${member.displayName} 本日應付`}>
          <div><span>{member.displayName} · {finalized ? "正式結算" : "薪資預覽"}</span><strong>{money(total)} <small>G</small></strong></div>
          <dl><div><dt>指定小費</dt><dd>{money(designatedTips)} G</dd></div><div><dt>公共小費</dt><dd>{money(publicTips)} G</dd></div><div><dt>收入項目</dt><dd>{personalResults.length}</dd></div></dl>
        </section>
      ) : <p className="adminEmptyText">目前帳號未連結結算人員。</p>}
      <AdminPanel title="薪資組成" description="服務員／經理薪資為時薪 × 計薪時數＋營收分成；指名職位維持底薪與營收分成擇優。額外服務分潤及小費另計。幕後參與僅限開發人員。">
        {personalResults.length ? <>
          <div className="adminSettlementTableWrap"><table className="adminSettlementTable adminSettlementCompactTable"><thead><tr><th>計薪／收入項目</th><th className="adminSettlementNumber">底薪</th><th className="adminSettlementNumber">營收分成</th><th className="adminSettlementNumber">指定小費</th><th className="adminSettlementNumber">公共小費</th><th className="adminSettlementNumber">應付</th></tr></thead><tbody>{personalResults.map((item) => <tr key={`${item.staffId}-${item.role}`}>
          <td>{settlementRoles[item.role] || item.role}</td>
          <td className="adminSettlementNumber">{money(item.basePay)} G</td>
          <td className="adminSettlementNumber">{money(item.revenueShare)} G</td>
          <td className="adminSettlementNumber">{money(item.designatedTip)} G</td>
          <td className="adminSettlementNumber">{money(item.publicTip)} G</td>
          <td className="adminSettlementNumber"><strong>{money(item.afterRounding)} G</strong></td>
        </tr>)}</tbody></table></div>
          <div className="adminSettlementSourceList">{personalResults.map((item) => <details className="adminSettlementSourceDisclosure" key={`sources-${item.staffId}-${item.role}`}>
            <summary>{settlementRoles[item.role] || item.role} · 查看金額來源</summary>
            <SourceDetails item={item} inputs={personalInputs} run={run} summary={summary} finalized={finalized} />
          </details>)}</div>
        </> : <p className="adminEmptyText">這位人員在本時段尚無薪資結果。</p>}
        {personalResults.filter((item) => item.anomalyStatus !== "normal").map((item) => <p key={`${item.staffId}-${item.role}`} className="adminSettlementInlineWarning">{item.anomalyNote || item.anomalyStatus}</p>)}
      </AdminPanel>
      {personalInputs.length ? <AdminPanel title="計薪工時" description="出勤事件與計薪輸入分別保留，重新計算後更新薪資預覽。"><div className="adminSettlementTableWrap"><table className="adminSettlementTable adminSettlementCompactTable"><thead><tr><th>角色</th><th>實際分鐘</th><th>計薪時數</th><th>出勤來源</th></tr></thead><tbody>{personalInputs.map((item) => <tr key={`${item.staffId}-${item.role}`}><td>{settlementRoles[item.role] || item.role}</td><td>{item.actualMinutes}</td><td>{item.payableHours} 小時</td><td>{attendanceSourceLabels[item.attendanceSource]}</td></tr>)}</tbody></table></div></AdminPanel> : null}
    </>
  );
}
