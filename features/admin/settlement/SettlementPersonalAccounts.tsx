import { AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import type { SettlementResult, SettlementStaff, SettlementStaffInput } from "./types";
import { settlementMoney as money, settlementRoles } from "./presentation";

type Props = {
  staff: SettlementStaff[];
  selectedId: string;
  results: SettlementResult[];
  inputs: SettlementStaffInput[];
  canManage: boolean;
  finalized: boolean;
  saving: boolean;
  onSelect: (id: string) => void;
};

export function SettlementPersonalAccounts({ staff, selectedId, results, inputs, canManage, finalized, saving, onSelect }: Props) {
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
          <dl><div><dt>指定小費</dt><dd>{money(designatedTips)} G</dd></div><div><dt>公共小費</dt><dd>{money(publicTips)} G</dd></div><div><dt>角色數</dt><dd>{personalResults.length}</dd></div></dl>
        </section>
      ) : <p className="adminEmptyText">目前帳號未連結結算人員。</p>}
      <AdminPanel title="薪資組成" description="各角色的底薪與營收分成擇優，再獨立加計小費。">
        {personalResults.length ? <div className="adminSettlementTableWrap"><table className="adminSettlementTable adminSettlementCompactTable"><thead><tr><th>角色</th><th className="adminSettlementNumber">底薪</th><th className="adminSettlementNumber">營收分成</th><th className="adminSettlementNumber">指定小費</th><th className="adminSettlementNumber">公共小費</th><th className="adminSettlementNumber">應付</th></tr></thead><tbody>{personalResults.map((item) => <tr key={`${item.staffId}-${item.role}`}><td>{settlementRoles[item.role] || item.role}</td><td className="adminSettlementNumber">{money(item.basePay)} G</td><td className="adminSettlementNumber">{money(item.revenueShare)} G</td><td className="adminSettlementNumber">{money(item.designatedTip)} G</td><td className="adminSettlementNumber">{money(item.publicTip)} G</td><td className="adminSettlementNumber"><strong>{money(item.afterRounding)} G</strong></td></tr>)}</tbody></table></div> : <p className="adminEmptyText">這位人員在本時段尚無薪資結果。</p>}
        {personalResults.filter((item) => item.anomalyStatus !== "normal").map((item) => <p key={`${item.staffId}-${item.role}`} className="adminSettlementInlineWarning">{item.anomalyNote || item.anomalyStatus}</p>)}
      </AdminPanel>
      {personalInputs.length ? <AdminPanel title="計薪工時" description="出勤事件與計薪輸入分別保留，重新計算後更新薪資預覽。"><div className="adminSettlementTableWrap"><table className="adminSettlementTable adminSettlementCompactTable"><thead><tr><th>角色</th><th>實際分鐘</th><th>計薪時數</th><th>出勤來源</th></tr></thead><tbody>{personalInputs.map((item) => <tr key={`${item.staffId}-${item.role}`}><td>{settlementRoles[item.role] || item.role}</td><td>{item.actualMinutes}</td><td>{item.payableHours} 小時</td><td>{item.attendanceSource === "clock" ? "打卡紀錄" : item.attendanceSource === "backfill_approved" ? "補打卡已核准" : "待核准"}</td></tr>)}</tbody></table></div></AdminPanel> : null}
    </>
  );
}
