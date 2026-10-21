import { useId } from "react";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import type { FinanceTipAllocationInput, FinanceTipDistributionMode, FinanceTipStaffOption } from "./finance-types";

export interface TipDistributionInput {
  mode: FinanceTipDistributionMode;
  allocations: FinanceTipAllocationInput[];
}
export function TipDistributionFields({ value, staff, onChange }: {
  value: TipDistributionInput;
  staff: FinanceTipStaffOption[];
  onChange: (value: TipDistributionInput) => void;
}) {
  const id = useId();
  const changeMode = (mode: FinanceTipDistributionMode) => onChange({ mode,
    allocations: [] });
  return <fieldset className="adminOrderTipFields">
    <legend>小費分配</legend>
    <div className="adminField adminOrderTipModeField">
      <div className="adminFieldHeading">
        <label htmlFor={`${id}-mode`}>分配方式</label>
        <AdminHelp title="小費分配方式">公共小費在結算時依主要職位的合資格計薪工時分配，不在此處指定人員。指定店員由一人領取；自訂比例須合計 100%。實收或出勤補正後，已正式結算的薪資需由經理重新結算。</AdminHelp>
      </div>
      <select id={`${id}-mode`} value={value.mode} onChange={e => {
      const mode = e.target.value;
      if (mode === "public" || mode === "designated" || mode === "custom") changeMode(mode);
    }}>
      {value.mode === "equal" && <option value="equal" disabled>舊版人頭均分（請更正）</option>}<option value="public">公共小費（按工時分配）</option><option value="designated">指定店員</option><option value="custom">自訂比例</option>
      </select>
    </div>
    {value.mode !== "public" && staff.length === 0 && <p role="status">此營業日尚無有計薪分鐘的出勤人員，請先核對結算出勤。</p>}
    {value.mode === "equal" && <p role="alert">此為舊版按人頭均分，請選擇正確分配方式後填原因更正。</p>}
    {value.mode === "designated" && <label className="adminField adminOrderTipModeField">領取店員<select value={value.allocations[0]?.staffId || ""}
      onChange={e => onChange({ mode: value.mode, allocations: e.target.value ? [{ staffId: e.target.value, percentage: null }] : [] })}>
      <option value="">請選擇</option>{staff.map(x => <option key={x.staffId} value={x.staffId}>{x.displayName}</option>)}
    </select></label>}
    {value.mode === "custom" && <div className="adminOrderTipStaffList">{staff.map(person => {
      const selected = value.allocations.find(x => x.staffId === person.staffId);
      return <div key={person.staffId} className="adminOrderTipStaffChoice">
        <label className="adminOrderTipStaffName"><input type="checkbox" checked={!!selected} onChange={e => onChange({ mode: value.mode,
          allocations: e.target.checked ? [...value.allocations, { staffId: person.staffId, percentage: 0 }]
            : value.allocations.filter(x => x.staffId !== person.staffId) })} /><span>{person.displayName}</span></label>
        {selected && <div className="adminOrderTipPercentage"><input type="number" min="0.01" max="100" step="0.01" aria-label={`${person.displayName}比例 %`}
          value={selected.percentage ?? 0} onChange={e => onChange({ mode: value.mode, allocations: value.allocations.map(x =>
            x.staffId === person.staffId ? { ...x, percentage: Number(e.target.value) } : x) })} /><span aria-hidden="true">%</span></div>}
      </div>;
    })}</div>}
    {value.mode === "custom" && <p className="adminOrderTipStatus" aria-live="polite">比例合計 <strong>{value.allocations.reduce((n, x) => n + (x.percentage || 0), 0)}%</strong>／100%</p>}
  </fieldset>;
}
