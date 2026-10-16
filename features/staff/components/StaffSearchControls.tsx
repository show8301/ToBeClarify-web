import { ArrowUpRight, RotateCcw } from "lucide-react";

export type StaffFilter = "all" | "yes" | "no";

type StaffSearchControlsProps = {
  query: string;
  dutyFilter: StaffFilter;
  nominationFilter: StaffFilter;
  resultCount: number;
  onQueryChange: (value: string) => void;
  onDutyChange: (value: StaffFilter) => void;
  onNominationChange: (value: StaffFilter) => void;
  onClear: () => void;
};

function FilterGroup({ label, value, options, onChange }: {
  label: string;
  value: StaffFilter;
  options: readonly [string, string, string];
  onChange: (value: StaffFilter) => void;
}) {
  return (
    <fieldset className="staff-filter-group">
      <legend className="sr-only">{label}</legend>
      <span className="staff-filter-caption" aria-hidden="true">{label}</span>
      <span className="staff-filter-options">
        {(["all", "yes", "no"] as const).map((option, index) => (
          <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
            {options[index]}
          </button>
        ))}
      </span>
    </fieldset>
  );
}

export default function StaffSearchControls(props: StaffSearchControlsProps) {
  const active = Boolean(props.query.trim()) || props.dutyFilter !== "all" || props.nominationFilter !== "all";
  return (
    <section className="gallery-controls staff-search-controls" aria-label="店員搜尋與篩選">
      <div className="staff-search-count" role="status" aria-live="polite" aria-atomic="true">
        <span>{active ? "符合店員" : "ALL STAFF"}</span><b>{String(props.resultCount).padStart(2, "0")}</b>
      </div>
      <FilterGroup label="值班狀態" value={props.dutyFilter} options={["全部", "今日值班", "未值班"]} onChange={props.onDutyChange} />
      <FilterGroup label="指名條件" value={props.nominationFilter} options={["全部", "可以指名", "不可指名"]} onChange={props.onNominationChange} />
      <label className="staff-search-input">
        <span className="sr-only">搜尋店員名字、介紹或服務</span>
        <input type="search" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="搜尋名字、介紹或服務…" aria-controls="staff-search-results" />
        <b aria-hidden="true">SEARCH <ArrowUpRight /></b>
      </label>
      <button className="staff-search-clear" type="button" disabled={!active} onClick={props.onClear}>
        <RotateCcw aria-hidden="true" /><span>清除條件</span>
      </button>
    </section>
  );
}
