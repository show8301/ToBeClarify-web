import type { SettlementStaff, SettlementStaffInput, SettlementPayrollAssignment } from "./types";
import { Pencil } from "lucide-react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { settlementRoles } from "./presentation";

type Props = {
  inputs: SettlementStaffInput[];
  assignments: SettlementPayrollAssignment[];
  onRemove: (index: number) => void;
  onCorrectRole: (item: SettlementStaffInput) => void;
  staff: SettlementStaff[];
  editable: boolean;
  isEvent: boolean;
  onAdd: (staffId: string, role: string) => void;
  onChange: (index: number, key: keyof SettlementStaffInput, value: unknown) => void;
};

export function SettlementStaffInputTable({ inputs, staff, assignments, editable, isEvent, onAdd, onChange, onRemove, onCorrectRole }: Props) {
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
            {staff.flatMap((member) => {
              const assignment = assignments.find(item => item.staffId === member.id);
              const roles = assignment?.payrollRole ? [assignment.payrollRole, ...(assignment.canUseBackstage && assignment.payrollRole !== "backstage" ? ["backstage"] : [])] : [];
              return roles.filter(role => !inputs.some(item => item.staffId === member.id && item.role === role)).map((role) => (
              <option key={`${member.id}-${role}`} value={`${member.id}|${role}`}>{member.displayName} · {settlementRoles[role]}</option>
            )); })}
          </select>
        </label>
      ) : null}
      {inputs.length ? (
        <div className="adminSettlementTableWrap">
          <table className="adminSettlementTable">
            <thead><tr><th>人員</th><th>角色</th><th>實際分鐘</th><th>計薪時數</th>{isEvent ? <th>活動分配時數</th> : null}<th>出勤來源</th><th>公共小費</th><th>幕後參與</th>{editable ? <th>操作</th> : null}</tr></thead>
            <tbody>
              {inputs.map((item, index) => (
                <tr key={`${item.staffId}-${item.role}`}>
                  <td>{item.displayName}</td>
                  <td>
                    <div className="adminSettlementPayrollRole">
                      <span>{settlementRoles[item.role] || item.role}</span>
                      {editable && (item.role !== "backstage" || assignments.find(assignment => assignment.staffId === item.staffId)?.payrollRole === "backstage") ? (
                        <AdminButton variant="ghost" className="iconActionButton"
                          aria-label={`更正${item.displayName}的計薪職位`} title="更正職位"
                          onClick={() => onCorrectRole(item)}>
                          <Pencil aria-hidden="true" />
                        </AdminButton>
                      ) : null}
                    </div>
                  </td>
                  <td><input aria-label={`${item.displayName} ${settlementRoles[item.role] || item.role} 實際分鐘`} type="number" min="0" value={item.actualMinutes} disabled={!editable} onChange={(event) => onChange(index, "actualMinutes", Number(event.target.value) || 0)} /></td>
                  <td className="adminSettlementNumber">{item.payableHours}</td>
                  {isEvent ? <td><input aria-label={`${item.displayName} 活動分配時數`} type="number" min="0" step="0.5" value={item.activityHours ?? ""} disabled={!editable} onChange={(event) => onChange(index, "activityHours", event.target.value === "" ? null : Number(event.target.value))} /></td> : null}
                  <td>{item.attendanceSource === "clock" ? "打卡帶入" : item.attendanceSource === "backfill_approved" ? "補打卡已核准" : "待核准"}</td>
                  <td>{item.publicTipEligible ? "自動納入" : "不納入"}</td>
                  <td>{item.role === "backstage" ? <input aria-label={`${item.displayName} 幕後參與`} type="checkbox" checked={item.isBackstageParticipant} disabled={!editable} onChange={(event) => onChange(index, "isBackstageParticipant", event.target.checked)} /> : "不適用"}</td>
                  {editable ? <td><AdminButton variant="ghost" onClick={() => onRemove(index)}>移除輸入</AdminButton></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="adminEmptyText">本時段尚無人員計薪輸入。</p>}
    </>
  );
}
