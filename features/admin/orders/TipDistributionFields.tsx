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
  const changeMode = (mode: FinanceTipDistributionMode) => onChange({ mode,
    allocations: mode === "equal" ? staff.map(x => ({ staffId: x.staffId, percentage: null })) : [] });
  return <fieldset className="adminOrderFinanceTipStaff">
    <legend>小費分配</legend>
    <label>分配方式<select value={value.mode} onChange={e => {
      const mode = e.target.value;
      if (mode === "equal" || mode === "designated" || mode === "custom") changeMode(mode);
    }}>
      <option value="equal">上班員工均分</option><option value="designated">指定店員</option><option value="custom">自訂比例</option>
    </select></label>
    {staff.length === 0 && <p role="status">此營業日尚無有計薪分鐘的出勤人員，請先核對結算出勤。</p>}
    {value.mode === "equal" && <p>依本次確認的出勤名單按人均分：{staff.map(x => x.displayName).join("、") || "無"}。分配名單儲存後不隨出勤變動自動改寫。</p>}
    {value.mode === "designated" && <label>領取店員<select value={value.allocations[0]?.staffId || ""}
      onChange={e => onChange({ mode: value.mode, allocations: e.target.value ? [{ staffId: e.target.value, percentage: null }] : [] })}>
      <option value="">請選擇</option>{staff.map(x => <option key={x.staffId} value={x.staffId}>{x.displayName}</option>)}
    </select></label>}
    {value.mode === "custom" && staff.map(person => {
      const selected = value.allocations.find(x => x.staffId === person.staffId);
      return <label key={person.staffId} className="adminOrderFinanceTipStaffChoice">
        <span><input type="checkbox" checked={!!selected} onChange={e => onChange({ mode: value.mode,
          allocations: e.target.checked ? [...value.allocations, { staffId: person.staffId, percentage: 0 }]
            : value.allocations.filter(x => x.staffId !== person.staffId) })} />{person.displayName}</span>
        {selected && <input type="number" min="0.01" max="100" step="0.01" aria-label={`${person.displayName}比例 %`}
          value={selected.percentage ?? 0} onChange={e => onChange({ mode: value.mode, allocations: value.allocations.map(x =>
            x.staffId === person.staffId ? { ...x, percentage: Number(e.target.value) } : x) })} />}
      </label>;
    })}
    {value.mode === "custom" && <p>比例合計 {value.allocations.reduce((n, x) => n + (x.percentage || 0), 0)}%（須為 100%）</p>}
  </fieldset>;
}
