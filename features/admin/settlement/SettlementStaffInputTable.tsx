import type { SettlementStaff, SettlementStaffInput } from "./types";
import { settlementRoles } from "./presentation";

type Props = {
  inputs: SettlementStaffInput[];
  staff: SettlementStaff[];
  editable: boolean;
  isEvent: boolean;
  onAdd: (staffId: string, role: string) => void;
  onChange: (index: number, key: keyof SettlementStaffInput, value: unknown) => void;
};

export function SettlementStaffInputTable({ inputs, staff, editable, isEvent, onAdd, onChange }: Props) {
  return (
    <>
      {editable ? (
        <label className="adminField adminSettlementAddInput">
          <span>新增結算人員</span>
          <select defaultValue="" onChange={(event) => {
            const [staffId, role] = event.target.value.split("|");
            if (staffId && role) onAdd(staffId, role);
            event.target.value = "";
          }}>
            <option value="">選擇人員與角色…</option>
            {staff.flatMap((member) => ["designated", "service", "manager", "backstage"].map((role) => (
              <option key={`${member.id}-${role}`} value={`${member.id}|${role}`}>{member.displayName} · {settlementRoles[role]}</option>
            )))}
          </select>
        </label>
      ) : null}
      {inputs.length ? (
        <div className="adminSettlementTableWrap">
          <table className="adminSettlementTable">
            <thead><tr><th>人員</th><th>角色</th><th>實際分鐘</th><th>計薪時數</th>{isEvent ? <th>活動分配時數</th> : null}<th>出勤來源</th><th>公共小費</th><th>幕後參與</th></tr></thead>
            <tbody>
              {inputs.map((item, index) => (
                <tr key={`${item.staffId}-${item.role}`}>
                  <td>{item.displayName}</td><td>{settlementRoles[item.role] || item.role}</td>
                  <td><input aria-label={`${item.displayName} ${settlementRoles[item.role] || item.role} 實際分鐘`} type="number" min="0" value={item.actualMinutes} disabled={!editable} onChange={(event) => onChange(index, "actualMinutes", Number(event.target.value) || 0)} /></td>
                  <td className="adminSettlementNumber">{item.payableHours}</td>
                  {isEvent ? <td><input aria-label={`${item.displayName} 活動分配時數`} type="number" min="0" step="0.5" value={item.activityHours ?? ""} disabled={!editable} onChange={(event) => onChange(index, "activityHours", event.target.value === "" ? null : Number(event.target.value))} /></td> : null}
                  <td><select aria-label={`${item.displayName} 出勤來源`} value={item.attendanceSource || "manual"} disabled={!editable || item.attendanceSource === "backfill_approved"} onChange={(event) => onChange(index, "attendanceSource", event.target.value)}><option value="manual">未核准</option><option value="clock">已由打卡帶入</option><option value="backfill_approved">補打卡已核准</option></select></td>
                  <td>{item.publicTipEligible ? "自動納入" : "不納入"}</td>
                  <td><input aria-label={`${item.displayName} 幕後參與`} type="checkbox" checked={item.isBackstageParticipant} disabled={!editable} onChange={(event) => onChange(index, "isBackstageParticipant", event.target.checked)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="adminEmptyText">本時段尚無人員計薪輸入。</p>}
    </>
  );
}
