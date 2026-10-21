import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AdminButton, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { getSettlementRules } from "./rule-api";
import type { SettlementRule } from "./types";
import { settlementMoney as money } from "./presentation";

type Props = {
  rule: SettlementRule;
  form: Omit<SettlementRule, "id">;
  setForm: Dispatch<SetStateAction<Omit<SettlementRule, "id">>>;
  saving: boolean;
  onSave: () => Promise<SettlementRule | null>;
  selected: SettlementRule | null;
  businessDate: string;
  finalized: boolean;
  onSelect: (rule: SettlementRule | null) => void;
  onCreate: (rule: SettlementRule) => void;
};

const numericFields = [
  ["designatedHourlyRate", "指名時薪"], ["serviceManagerHourlyRate", "服務生／經理時薪"],
  ["designatedSharePercentage", "指名分成 %"], ["publicRoomStaffPercentage", "公共包廂指名 %"],
  ["dedicatedRoomOwnerPercentage", "專屬包廂擁有者 %"], ["serviceManagerPoolPercentage", "服務生／經理池 %"],
  ["backstagePoolPercentage", "幕後池 %"], ["companyPercentage", "公司收入 %"],
] as const;

export function SettlementRuleSettings({ rule, form, setForm, saving, onSave, selected, businessDate, finalized, onSelect, onCreate }: Props) {
  const [editing, setEditing] = useState(false);
  const [rules, setRules] = useState<SettlementRule[]>([]);
  const [viewedId, setViewedId] = useState(rule.id);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getSettlementRules(controller.signal).then(next => { if (!controller.signal.aborted) { setRules(next); setError(""); } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "版本清單載入失敗。"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const available = [rule, ...rules.filter(x => x.id !== rule.id)];
  const viewed = available.find(x => x.id === viewedId) ?? rule;
  async function save() {
    const saved = await onSave();
    if (!saved) { setLoading(true); setRevision(n => n + 1); return; }
    setRules(current => [saved, ...current.filter(x => x.id !== saved.id)]);
    setViewedId(saved.id); setError(""); setEditing(false);
  }
  return (
    <>
      <div className="adminSettlementSectionHeading"><div><h2>結算設定</h2><p>時薪與分潤規則以生效日期建立版本。</p></div><AdminButton onClick={() => { onCreate(viewed); setEditing(true); }} disabled={saving || editing}>建立新規則版本</AdminButton></div>
      <div className="adminSettlementRuleVersion"><div><strong>本營業日使用的規則</strong><span>{rule.dayType === "event" ? "活動日" : "非活動日"} · {rule.effectiveFrom} 生效</span></div><span className="adminSettlementBadge">{finalized ? "正式結算快照" : "目前採用"}</span></div>
      <AdminPanel title="已儲存的規則版本" description="查看版本不會套用。選用後，請到營運結算保存／預覽；已結算時須由經理填原因建立新版。">
        <AdminField label="查看規則版本"><select value={viewed.id} disabled={saving || loading} onChange={e => setViewedId(e.target.value)}>
          {available.map(item => <option key={item.id} value={item.id}>{item.dayType === "event" ? "活動日" : "非活動日"} · {item.effectiveFrom} 生效 · {item.id.slice(0, 8)}{item.id === rule.id ? "（目前採用）" : ""}</option>)}
        </select></AdminField>
        <p>規則識別：{viewed.id}。下方顯示此版本的時薪與分潤設定。</p>
        {loading && <p role="status">正在讀取已儲存版本…</p>}
        {error && <p role="alert">{error}</p>}
        {viewed.effectiveFrom > businessDate && <p>此版本生效日晚於本營業日，選用將以此規則補正歷史結算，請核對原因與差額。</p>}
        <div className="adminSettlementActionBar"><AdminButton variant="ghost" disabled={saving || loading} onClick={() => { setLoading(true); setRevision(n => n + 1); }}>重新讀取版本</AdminButton>
          <AdminButton disabled={saving || loading || !!error || viewed.id === (selected?.id ?? rule.id)} onClick={() => onSelect(viewed)}>選用此規則</AdminButton>
          {selected && <AdminButton variant="ghost" disabled={saving} onClick={() => onSelect(null)}>取消規則變更</AdminButton>}
        </div>
        {selected && <p role="status">待套用：{selected.dayType === "event" ? "活動日" : "非活動日"} · {selected.effectiveFrom} · {selected.id.slice(0, 8)}。{finalized ? "請至營運結算最終步驟預覽並填原因重新結算。" : "請至營運結算保存輸入，再重新計算。"}</p>}
      </AdminPanel>
      <AdminPanel title="時薪基準"><div className="adminSettlementRuleRates">{[["指名人員", viewed.designatedHourlyRate], ["服務生／經理", viewed.serviceManagerHourlyRate], ["幕後技術", viewed.backstageHourlyRate]].map(([label, amount]) => <div key={String(label)}><span>{label}</span><strong>{money(Number(amount))} <small>G / 小時</small></strong></div>)}</div></AdminPanel>
      <AdminPanel title="分潤與計薪規則"><dl className="adminSettlementDefinitionList">{[["指名分成", `${viewed.designatedSharePercentage}%`], ["公共包廂指名", `${viewed.publicRoomStaffPercentage}%`], ["專屬包廂擁有者", `${viewed.dedicatedRoomOwnerPercentage}%`], ["服務生／經理池", `${viewed.serviceManagerPoolPercentage}%`], ["幕後池", `${viewed.backstagePoolPercentage}%`], ["公司收入", `${viewed.companyPercentage}%`], ["工時計薪", "全天加總，以半小時為切點"], ["最小支付單位", "1 Gil，金額無條件進位"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></AdminPanel>
      <section hidden={!editing} className="adminSettlementRuleEditor" aria-label="建立新規則版本">
        <AdminPanel title="新規則版本" description="新的生效規則不會覆寫已完成結算使用的快照。">
          <div className="adminFormGrid"><AdminField label="日期類型"><select value={form.dayType} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, dayType: event.target.value }))}><option value="normal">非活動日</option><option value="event">活動日</option></select></AdminField><AdminField label="生效日期"><input type="date" value={form.effectiveFrom} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))} /></AdminField>{numericFields.map(([key, label]) => <AdminField key={key} label={label}><input type="number" min="0" value={form[key]} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, [key]: Number(event.target.value) }))} /></AdminField>)}</div>
          <div className="adminSettlementActionBar"><span>金額支付單位固定為 1 Gil。</span><AdminButton variant="ghost" onClick={() => setEditing(false)} disabled={saving}>收起編輯</AdminButton><AdminButton onClick={() => void save()} disabled={saving}>保存新規則版本</AdminButton></div>
        </AdminPanel>
      </section>
    </>
  );
}
