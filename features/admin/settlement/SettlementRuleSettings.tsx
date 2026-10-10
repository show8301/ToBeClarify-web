import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AdminButton, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import type { SettlementRule } from "./types";
import { settlementMoney as money } from "./presentation";

type Props = {
  rule: SettlementRule;
  form: Omit<SettlementRule, "id">;
  setForm: Dispatch<SetStateAction<Omit<SettlementRule, "id">>>;
  saving: boolean;
  onSave: () => Promise<void>;
};

const numericFields = [
  ["designatedHourlyRate", "指名時薪"], ["serviceManagerHourlyRate", "服務生／經理時薪"],
  ["designatedSharePercentage", "指名分成 %"], ["publicRoomStaffPercentage", "公共包廂指名 %"],
  ["dedicatedRoomOwnerPercentage", "專屬包廂擁有者 %"], ["serviceManagerPoolPercentage", "服務生／經理池 %"],
  ["backstagePoolPercentage", "幕後池 %"], ["companyPercentage", "公司收入 %"],
] as const;

export function SettlementRuleSettings({ rule, form, setForm, saving, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <div className="adminSettlementSectionHeading"><div><h2>結算設定</h2><p>時薪與分潤規則以生效日期建立版本。</p></div><AdminButton onClick={() => setEditing(true)} disabled={saving || editing}>建立新規則版本</AdminButton></div>
      <div className="adminSettlementRuleVersion"><div><strong>本營業日使用的規則</strong><span>{rule.dayType === "event" ? "活動日" : "非活動日"} · {rule.effectiveFrom} 生效</span></div><span className="adminSettlementBadge">有效版本</span></div>
      <AdminPanel title="時薪基準"><div className="adminSettlementRuleRates">{[["指名人員", rule.designatedHourlyRate], ["服務生／經理", rule.serviceManagerHourlyRate], ["幕後技術", rule.backstageHourlyRate]].map(([label, amount]) => <div key={String(label)}><span>{label}</span><strong>{money(Number(amount))} <small>G / 小時</small></strong></div>)}</div></AdminPanel>
      <AdminPanel title="分潤與計薪規則"><dl className="adminSettlementDefinitionList">{[["指名分成", `${rule.designatedSharePercentage}%`], ["公共包廂指名", `${rule.publicRoomStaffPercentage}%`], ["專屬包廂擁有者", `${rule.dedicatedRoomOwnerPercentage}%`], ["服務生／經理池", `${rule.serviceManagerPoolPercentage}%`], ["幕後池", `${rule.backstagePoolPercentage}%`], ["公司收入", `${rule.companyPercentage}%`], ["工時計薪", "全天加總，以半小時為切點"], ["最小支付單位", "1 Gil，金額無條件進位"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></AdminPanel>
      <section hidden={!editing} className="adminSettlementRuleEditor" aria-label="建立新規則版本">
        <AdminPanel title="新規則版本" description="新的生效規則不會覆寫已完成結算使用的快照。">
          <div className="adminFormGrid"><AdminField label="日期類型"><select value={form.dayType} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, dayType: event.target.value }))}><option value="normal">非活動日</option><option value="event">活動日</option></select></AdminField><AdminField label="生效日期"><input type="date" value={form.effectiveFrom} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} /></AdminField>{numericFields.map(([key, label]) => <AdminField key={key} label={label}><input type="number" min="0" value={form[key]} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, [key]: Number(event.target.value) }))} /></AdminField>)}</div>
          <div className="adminSettlementActionBar"><span>金額支付單位固定為 1 Gil。</span><AdminButton variant="ghost" onClick={() => setEditing(false)} disabled={saving}>收起編輯</AdminButton><AdminButton onClick={() => void onSave()} disabled={saving}>保存新規則版本</AdminButton></div>
        </AdminPanel>
      </section>
    </>
  );
}
