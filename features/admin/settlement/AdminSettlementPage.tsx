"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminField, AdminPage, AdminPanel, AdminState } from "@/features/admin/shared/AdminShared.jsx";

type StaffInput = {
  staffId: string;
  displayName: string;
  roleTitle?: string | null;
  role: string;
  isWorking: boolean;
  actualMinutes: number;
  activityHours?: number | null;
  payableHours: number;
  publicTipEligible: boolean;
  isBackstageParticipant: boolean;
  note?: string | null;
};

type Overview = {
  run: any;
  rule: any;
  summary: any;
  staffInputs: StaffInput[];
  results: any[];
  anomalies: { code: string; message: string; sourceId?: string | null }[];
};

const today = () => new Date().toLocaleDateString("en-CA");
const money = (value: number) => Math.ceil(Number(value || 0)).toLocaleString("zh-TW");
const roleLabel: Record<string, string> = {
  designated: "指名人員",
  service: "服務生",
  manager: "經理",
  backstage: "幕後技術",
  dedicated_room_owner: "專屬包廂分成",
  activity: "活動日分配",
};

const emptyRule = (rule: any, dayType: string, effectiveFrom: string) => ({
  dayType,
  effectiveFrom,
  designatedHourlyRate: rule?.designatedHourlyRate ?? 30000,
  serviceManagerHourlyRate: rule?.serviceManagerHourlyRate ?? 50000,
  backstageHourlyRate: rule?.backstageHourlyRate ?? 0,
  designatedSharePercentage: rule?.designatedSharePercentage ?? 70,
  publicRoomStaffPercentage: rule?.publicRoomStaffPercentage ?? 70,
  dedicatedRoomOwnerPercentage: rule?.dedicatedRoomOwnerPercentage ?? 100,
  serviceManagerPoolPercentage: rule?.serviceManagerPoolPercentage ?? 25,
  backstagePoolPercentage: rule?.backstagePoolPercentage ?? 25,
  companyPercentage: rule?.companyPercentage ?? 50,
  timeRoundMinutes: rule?.timeRoundMinutes ?? 30,
  moneyRoundUnit: rule?.moneyRoundUnit ?? 1,
  publicTipMode: "hour_ratio",
});

export function AdminSettlementPage() {
  const [date, setDate] = useState(today);
  const [sessionNo, setSessionNo] = useState(1);
  const [dayType, setDayType] = useState("normal");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [inputs, setInputs] = useState<StaffInput[]>([]);
  const [runFields, setRunFields] = useState({ publicTipAmount: 0, admissionFeeOverride: "", activityExpense: 0, companyShareHours: "", activityHoursConfirmed: false });
  const [ruleForm, setRuleForm] = useState<any>(emptyRule(null, "normal", today()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextStaff] = await Promise.all([
        adminApi.getSettlement({ businessDate: date, sessionNo }),
        adminApi.getAllStaffList(),
      ]);
      setOverview(nextOverview);
      setDayType(nextOverview.run.dayType || "normal");
      setInputs(nextOverview.staffInputs || []);
      setStaff(nextStaff || []);
      setRunFields({
        publicTipAmount: nextOverview.run.publicTipAmount || 0,
        admissionFeeOverride: nextOverview.run.admissionFeeOverride ?? "",
        activityExpense: nextOverview.run.activityExpense || 0,
        companyShareHours: nextOverview.run.companyShareHours ?? "",
        activityHoursConfirmed: Boolean(nextOverview.run.activityHoursConfirmed),
      });
      setRuleForm(emptyRule(nextOverview.rule, nextOverview.rule.dayType || nextOverview.run.dayType || "normal", nextOverview.rule.effectiveFrom));
    } catch (nextError) {
      setError(nextError as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [date, sessionNo]);

  const updateInput = (index: number, key: keyof StaffInput, value: unknown) => {
    setInputs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };

  const addInput = (staffId: string, role: string) => {
    const member = staff.find((item) => item.id === staffId);
    if (!member || inputs.some((item) => item.staffId === staffId && item.role === role)) return;
    setInputs((current) => [...current, {
      staffId, displayName: member.displayName, roleTitle: member.roleTitle, role,
      isWorking: Boolean(member.isWorkingToday), actualMinutes: 0, activityHours: null,
      payableHours: 0, publicTipEligible: true, isBackstageParticipant: role === "backstage", note: "",
    }]);
  };

  const saveInputs = async () => {
    setSaving(true); setMessage("");
    try {
      const next = await adminApi.saveSettlementInputs({
        businessDate: date, sessionNo, dayType, ...runFields,
        admissionFeeOverride: runFields.admissionFeeOverride === "" ? null : Number(runFields.admissionFeeOverride),
        companyShareHours: runFields.companyShareHours === "" ? null : Number(runFields.companyShareHours),
        staffInputs: inputs.map((item) => ({
          staffId: item.staffId, role: item.role, actualMinutes: Number(item.actualMinutes || 0),
          activityHours: item.activityHours === "" ? null : (item.activityHours == null ? null : Number(item.activityHours)),
          publicTipEligible: Boolean(item.publicTipEligible), isBackstageParticipant: Boolean(item.isBackstageParticipant), note: item.note || null,
        })),
      });
      setOverview(next); setInputs(next.staffInputs || inputs); setMessage("結算輸入已保存。");
    } catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const calculate = async () => {
    setSaving(true); setMessage("");
    try { const next = await adminApi.calculateSettlement({ businessDate: date, sessionNo }); setOverview(next); setInputs(next.staffInputs || inputs); setMessage("已重新計算預覽，正式結算前仍可調整。"); }
    catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const finalize = async () => {
    if (!window.confirm("正式結算後本時段會鎖定，確定要繼續嗎？")) return;
    setSaving(true); setMessage("");
    try { const next = await adminApi.finalizeSettlement({ businessDate: date, sessionNo }); setOverview(next); setMessage("本營業時段已正式結算並鎖定。"); }
    catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const reopen = async () => {
    const reason = window.prompt("請輸入重新開放原因");
    if (!reason?.trim()) return;
    setSaving(true); setMessage("");
    try { const next = await adminApi.reopenSettlement({ businessDate: date, sessionNo, reason: reason.trim() }); setSessionNo(next.run.sessionNo); setOverview(next); setInputs(next.staffInputs || []); setMessage(`已建立第 ${next.run.sessionNo} 營業時段。`); }
    catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const saveRule = async () => {
    setSaving(true); setMessage("");
    try { const saved = await adminApi.saveSettlementRule({ ...ruleForm, effectiveFrom: ruleForm.effectiveFrom || date }); setRuleForm(emptyRule(saved, saved.dayType, saved.effectiveFrom)); setMessage("新規則版本已建立；既有規則不會被覆蓋。"); }
    catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const summary = overview?.summary;
  const availableStaff = useMemo(() => staff.filter((item) => item.isActive !== false), [staff]);
  const isFinalized = overview?.run.status === "finalized";

  return <AdminPage eyebrow="PAYROLL · SETTLEMENT" title="帳目／薪資結算" description="依營業日期鎖定規則版本，核對實收營業額、工時、小費與各角色薪資。" actions={<><AdminButton variant="secondary" onClick={() => void load()} disabled={loading || saving}>重新整理</AdminButton>{isFinalized ? <AdminButton onClick={() => void reopen()} disabled={saving}>重新開放新時段</AdminButton> : <AdminButton onClick={finalize} disabled={saving || !overview || overview.anomalies.length > 0}>正式結算</AdminButton>}</>}>
    <div className="adminSettlementToolbar"><AdminField label="營業日期"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></AdminField><AdminField label="營業時段"><input type="number" min="1" value={sessionNo} onChange={(event) => setSessionNo(Number(event.target.value) || 1)} /></AdminField><AdminField label="日期類型"><select value={dayType} onChange={(event) => setDayType(event.target.value)} disabled={Boolean(overview?.run.status !== "draft")}><option value="normal">非活動日</option><option value="event">活動日</option></select></AdminField><AdminButton variant="secondary" onClick={saveInputs} disabled={saving || isFinalized}>保存輸入</AdminButton><AdminButton onClick={calculate} disabled={saving || isFinalized}>重新計算</AdminButton></div>
    {message ? <div className="adminNotice" role="status">{message}</div> : null}
    <AdminState loading={loading} error={error} onRetry={() => void load()} />
    {!loading && !error && overview ? <>
      {overview.anomalies.length ? <AdminPanel title="需手動處理" description="以下項目會阻止正式結算；完成輸入或修正後重新計算。" className="adminSettlementAnomalies"><ul>{overview.anomalies.map((item) => <li key={`${item.code}-${item.sourceId || ""}`}>{item.message}{item.sourceId ? `（${item.sourceId}）` : ""}</li>)}</ul></AdminPanel> : null}
      <AdminPanel title="營業額與分潤摘要" description={`第 ${overview.run.sessionNo} 時段 · 規則 ${overview.rule.effectiveFrom} 生效 · 狀態 ${overview.run.status}`}>
        <div className="adminSettlementSummary">{[["有效營業額", summary.grossRevenue], ["指名營業額基礎", summary.designatedRevenueBase], ["公司營業額", summary.companyRevenue], ["服務生／經理池", summary.serviceManagerPool], ["幕後技術池", summary.backstagePool], ["公司收入", summary.companyIncome], ["應付薪資", summary.totalPayroll], ["公司補貼尾差", summary.companySubsidy]].map(([label, value]) => <div key={label as string}><span>{label}</span><strong>{money(value as number)} G</strong></div>)}</div>
      </AdminPanel>
      <AdminPanel title="結算輸入" description="工時請輸入全天實際分鐘數；系統會先全天加總，再以半小時切點進位。幕後技術人員勾選參與即可，不需要打卡。">
        <div className="adminFormGrid"><AdminField label="公共小費"><input type="number" min="0" value={runFields.publicTipAmount} onChange={(event) => setRunFields((current) => ({ ...current, publicTipAmount: Number(event.target.value) || 0 }))} hint="不包含既有指定店員小費。" /></AdminField><AdminField label="入場費覆寫"><input type="number" min="0" value={runFields.admissionFeeOverride} onChange={(event) => setRunFields((current) => ({ ...current, admissionFeeOverride: event.target.value }))} hint="留白時讀取後台啟用中的入場費設定。" /></AdminField><AdminField label="活動日活動費用"><input type="number" min="0" value={runFields.activityExpense} onChange={(event) => setRunFields((current) => ({ ...current, activityExpense: Number(event.target.value) || 0 }))} /></AdminField><AdminField label="活動日公司份額時數"><input type="number" min="0" step="0.5" value={runFields.companyShareHours} onChange={(event) => setRunFields((current) => ({ ...current, companyShareHours: event.target.value }))} /></AdminField></div>
        <div className="adminSettlementAddInput"><select defaultValue="" onChange={(event) => { const [staffId, role] = event.target.value.split("|"); if (staffId && role) addInput(staffId, role); event.target.value = ""; }}><option value="">新增人員角色輸入…</option>{availableStaff.flatMap((member) => ["designated", "service", "manager", "backstage"].map((role) => <option key={`${member.id}-${role}`} value={`${member.id}|${role}`}>{member.displayName} · {roleLabel[role]}</option>))}</select></div>
        <div className="adminSettlementTableWrap"><table className="adminSettlementTable"><thead><tr><th>人員</th><th>角色</th><th>實際分鐘</th><th>計薪時數</th><th>活動日分配時數</th><th>公共小費</th><th>幕後參與</th></tr></thead><tbody>{inputs.map((item, index) => <tr key={`${item.staffId}-${item.role}`}><td>{item.displayName}</td><td>{roleLabel[item.role] || item.role}</td><td><input type="number" min="0" value={item.actualMinutes} onChange={(event) => updateInput(index, "actualMinutes", Number(event.target.value) || 0)} /></td><td>{item.payableHours}</td><td><input type="number" min="0" step="0.5" value={item.activityHours ?? ""} onChange={(event) => updateInput(index, "activityHours", event.target.value === "" ? null : Number(event.target.value))} /></td><td><input type="checkbox" checked={item.publicTipEligible} disabled={item.role === "backstage"} onChange={(event) => updateInput(index, "publicTipEligible", event.target.checked)} /></td><td><input type="checkbox" checked={item.isBackstageParticipant} onChange={(event) => updateInput(index, "isBackstageParticipant", event.target.checked)} /></td></tr>)}</tbody></table></div>
        {dayType === "event" ? <label className="adminSettlementConfirm"><input type="checkbox" checked={runFields.activityHoursConfirmed} onChange={(event) => setRunFields((current) => ({ ...current, activityHoursConfirmed: event.target.checked }))} /> 我已確認活動日個人分配時數與公司份額時數。</label> : null}
      </AdminPanel>
      <AdminPanel title="薪資明細" description="底薪與營收分成擇優，小費獨立加計；每筆金額無條件進位，尾差由公司補貼。"><div className="adminSettlementTableWrap"><table className="adminSettlementTable"><thead><tr><th>人員</th><th>角色</th><th>底薪</th><th>營收分成</th><th>指定小費</th><th>公共小費</th><th>進位後應付</th><th>異常</th></tr></thead><tbody>{overview.results.map((item, index) => <tr key={`${item.staffId || "company"}-${item.role}-${index}`}><td>{item.displayName || item.staffId || "公司"}</td><td>{roleLabel[item.role] || item.role}</td><td>{money(item.basePay)} G</td><td>{money(item.revenueShare)} G</td><td>{money(item.designatedTip)} G</td><td>{money(item.publicTip)} G</td><td><strong>{money(item.afterRounding)} G</strong></td><td>{item.anomalyStatus !== "normal" ? item.anomalyNote || item.anomalyStatus : "—"}</td></tr>)}</tbody></table></div></AdminPanel>
      <AdminPanel title="可調整規則版本" description="規則以生效日期版本化；建立新版本不會改寫已完成結算使用的快照。"><div className="adminFormGrid">{[["dayType", "日期類型", "select"], ["effectiveFrom", "生效日期", "date"], ["designatedHourlyRate", "指名時薪", "number"], ["serviceManagerHourlyRate", "服務生／經理時薪", "number"], ["designatedSharePercentage", "指名分成 %", "number"], ["publicRoomStaffPercentage", "公共包廂指名 %", "number"], ["dedicatedRoomOwnerPercentage", "專屬包廂擁有者 %", "number"], ["serviceManagerPoolPercentage", "服務生／經理池 %", "number"], ["backstagePoolPercentage", "幕後池 %", "number"], ["companyPercentage", "公司收入 %", "number"]].map(([key, label, type]) => <AdminField key={key} label={label}><>{type === "select" ? <select value={(ruleForm as any)[key]} onChange={(event) => setRuleForm((current: any) => ({ ...current, [key]: event.target.value }))}><option value="normal">非活動日</option><option value="event">活動日</option></select> : <input type={type as "date" | "number"} min="0" value={(ruleForm as any)[key]} onChange={(event) => setRuleForm((current: any) => ({ ...current, [key]: type === "date" ? event.target.value : Number(event.target.value) }))} />}</></AdminField>)}</div><AdminButton variant="secondary" onClick={saveRule} disabled={saving}>建立規則版本</AdminButton></AdminPanel>
    </> : null}
  </AdminPage>;
}
