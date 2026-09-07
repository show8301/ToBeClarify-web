"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttendanceBackfill, SettlementResult, SettlementRule, SettlementRun, SettlementStaff, SettlementSummary } from "./types";
import { adminApi } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
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
  attendanceSource: "manual" | "clock" | "backfill_approved";
  attendanceRequestId?: string | null;
  attendanceBackfillStatus?: string | null;
  attendanceBackfillReason?: string | null;
  note?: string | null;
};

type Overview = {
  run: SettlementRun;
  rule: SettlementRule;
  summary: SettlementSummary;
  staffInputs: StaffInput[];
  results: SettlementResult[];
  anomalies: { code: string; message: string; sourceId?: string | null }[];
  attendanceBackfillRequests: AttendanceBackfill[];
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

const emptyRule = (rule: SettlementRule | null, dayType: string, effectiveFrom: string) => ({
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
  const { user } = useAdminAuth();
  const canManage = user?.role === "developer" || user?.role === "manager";
  const [date, setDate] = useState(today);
  const [sessionNo, setSessionNo] = useState(1);
  const [dayType, setDayType] = useState("normal");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [staff, setStaff] = useState<SettlementStaff[]>([]);
  const [inputs, setInputs] = useState<StaffInput[]>([]);
  const [runFields, setRunFields] = useState({ publicTipAmount: 0, admissionFeeOverride: "", activityExpense: 0, companyShareHours: "", activityHoursConfirmed: false });
  const [ruleForm, setRuleForm] = useState<Omit<SettlementRule, "id">>(emptyRule(null, "normal", today()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  const [backfillForm, setBackfillForm] = useState({ staffId: "", role: "designated", requestedMinutes: "", reason: "" });

  const loadSequence = useRef(0);
  const load = useCallback((signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    return Promise.all([
        adminApi.getSettlement({ businessDate: date, sessionNo }, signal),
        canManage ? adminApi.getStaffMembers(signal) : Promise.resolve([]),
      ]).then(([nextOverview, nextStaff]) => {
      if (signal?.aborted || sequence !== loadSequence.current) return;
      setError(null);
      setOverview(nextOverview);
      setDayType(nextOverview.run.dayType || "normal");
      setInputs(nextOverview.staffInputs || []);
      setStaff(canManage ? (nextStaff || []) : (user?.staffMemberId ? [{ id: user.staffMemberId, displayName: user.displayName, isActive: true }] : []));
      setRunFields({
        publicTipAmount: nextOverview.run.publicTipAmount || 0,
        admissionFeeOverride: nextOverview.run.admissionFeeOverride == null ? "" : String(nextOverview.run.admissionFeeOverride),
        activityExpense: nextOverview.run.activityExpense || 0,
        companyShareHours: nextOverview.run.companyShareHours == null ? "" : String(nextOverview.run.companyShareHours),
        activityHoursConfirmed: Boolean(nextOverview.run.activityHoursConfirmed),
      });
      setRuleForm(emptyRule(nextOverview.rule, nextOverview.rule.dayType || nextOverview.run.dayType || "normal", nextOverview.rule.effectiveFrom));
      setBackfillForm((current) => ({ ...current, staffId: current.staffId || nextOverview.staffInputs?.[0]?.staffId || "" }));
    }).catch((nextError: unknown) => {
      if (!signal?.aborted && sequence === loadSequence.current) setError(nextError as Error);
    }).finally(() => {
      if (!signal?.aborted && sequence === loadSequence.current) setLoading(false);
    });
  }, [date, sessionNo, canManage, user]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const updateInput = (index: number, key: keyof StaffInput, value: unknown) => {
    setInputs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };

  const addInput = (staffId: string, role: string) => {
    const member = staff.find((item) => item.id === staffId);
    if (!member || inputs.some((item) => item.staffId === staffId && item.role === role)) return;
      setInputs((current) => [...current, {
      staffId, displayName: member.displayName, roleTitle: member.roleTitle, role,
      isWorking: Boolean(member.isWorkingToday), actualMinutes: 0, activityHours: null,
      payableHours: 0, publicTipEligible: true, isBackstageParticipant: role === "backstage", attendanceSource: "manual", note: "",
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
          activityHours: item.activityHours == null ? null : Number(item.activityHours),
          publicTipEligible: true, isBackstageParticipant: Boolean(item.isBackstageParticipant),
          attendanceSource: item.attendanceSource || "manual", note: item.note || null,
        })),
      });
      setOverview(next); setInputs(next.staffInputs || inputs); setMessage("結算輸入已保存。");
    } catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const submitBackfill = async () => {
    if (!backfillForm.staffId || !backfillForm.requestedMinutes || !backfillForm.reason.trim()) {
      setMessage("補打卡申請需要人員、分鐘數與理由。");
      return;
    }
    setSaving(true); setMessage("");
    try {
      const next = await adminApi.submitSettlementAttendanceBackfill({
        businessDate: date, sessionNo, dayType, staffId: backfillForm.staffId, role: backfillForm.role,
        requestedMinutes: Number(backfillForm.requestedMinutes), reason: backfillForm.reason.trim(),
      });
      setOverview(next); setInputs(next.staffInputs || inputs);
      setBackfillForm((current) => ({ ...current, requestedMinutes: "", reason: "" }));
      setMessage("補打卡申請已送出，待開發人員或店經理核准。");
    } catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const reviewBackfill = async (requestId: string, approved: boolean) => {
    const note = window.prompt(approved ? "可填寫核准備註" : "請填寫拒絕原因", "") ?? "";
    if (!approved && !note.trim()) return;
    setSaving(true); setMessage("");
    try {
      const next = await adminApi.reviewSettlementAttendanceBackfill(requestId, { businessDate: date, sessionNo, approved, note: note.trim() || null });
      setOverview(next); setInputs(next.staffInputs || inputs); setMessage(approved ? "補打卡已核准。" : "補打卡已拒絕。");
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
  const availableStaff = useMemo(() => staff.filter((item) => item.isActive !== false && (canManage || item.id === user?.staffMemberId)), [canManage, staff, user?.staffMemberId]);
  const isFinalized = overview?.run.status === "finalized";

  return <AdminPage eyebrow="PAYROLL · SETTLEMENT" title="帳目／薪資結算" description="依營業日期鎖定規則版本，核對實收營業額、工時、小費與各角色薪資。" actions={<><AdminButton variant="secondary" onClick={() => { setLoading(true); void load(); }} disabled={loading || saving}>重新整理</AdminButton>{canManage && (isFinalized ? <AdminButton onClick={() => void reopen()} disabled={saving}>重新開放新時段</AdminButton> : <AdminButton onClick={finalize} disabled={loading || saving || !overview || overview.anomalies.length > 0}>正式結算</AdminButton>)}</>}>
    <div className="adminSettlementToolbar"><AdminField label="營業日期"><input type="date" value={date} onChange={(event) => { setLoading(true); setDate(event.target.value); }} /></AdminField><AdminField label="營業時段"><input type="number" min="1" value={sessionNo} onChange={(event) => { setLoading(true); setSessionNo(Number(event.target.value) || 1); }} /></AdminField><AdminField label="日期類型"><select value={dayType} onChange={(event) => setDayType(event.target.value)} disabled={!canManage || Boolean(overview?.run.status !== "draft")}><option value="normal">非活動日</option><option value="event">活動日</option></select></AdminField>{canManage ? <><AdminButton variant="secondary" onClick={saveInputs} disabled={loading || saving || isFinalized}>保存輸入</AdminButton><AdminButton onClick={calculate} disabled={loading || saving || isFinalized}>重新計算</AdminButton></> : null}</div>
    {message ? <div className="adminNotice" role="status">{message}</div> : null}
    <AdminState loading={loading} error={error} onRetry={() => void load()} />
    {!loading && !error && overview && summary ? <>
      {overview.anomalies.length ? <AdminPanel title="需手動處理" description="以下項目會阻止正式結算；完成輸入或修正後重新計算。" className="adminSettlementAnomalies"><ul>{overview.anomalies.map((item) => <li key={`${item.code}-${item.sourceId || ""}`}>{item.message}{item.sourceId ? `（${item.sourceId}）` : ""}</li>)}</ul></AdminPanel> : null}
      <AdminPanel title="營業額與分潤摘要" description={`第 ${overview.run.sessionNo} 時段 · 規則 ${overview.rule.effectiveFrom} 生效 · 狀態 ${overview.run.status}`}>
        <div className="adminSettlementSummary">{[["有效營業額", summary.grossRevenue], ["指名營業額基礎", summary.designatedRevenueBase], ["公司營業額", summary.companyRevenue], ["服務生／經理池", summary.serviceManagerPool], ["幕後技術池", summary.backstagePool], ["公司收入", summary.companyIncome], ["應付薪資", summary.totalPayroll], ["公司補貼尾差", summary.companySubsidy]].map(([label, value]) => <div key={label as string}><span>{label}</span><strong>{money(value as number)} G</strong></div>)}</div>
      </AdminPanel>
      <AdminPanel title="結算輸入" description="工時請輸入全天實際分鐘數；系統會先全天加總，再以半小時切點進位。公共小費名單由核准出勤資料自動產生，幕後技術人員不納入公共小費。">
        <div className="adminFormGrid"><AdminField label="公共小費" hint="不包含既有指定店員小費。"><input type="number" min="0" value={runFields.publicTipAmount} disabled={!canManage} onChange={(event) => setRunFields((current) => ({ ...current, publicTipAmount: Number(event.target.value) || 0 }))} /></AdminField><AdminField label="入場費覆寫" hint="留白時讀取後台啟用中的入場費設定。"><input type="number" min="0" value={runFields.admissionFeeOverride} disabled={!canManage} onChange={(event) => setRunFields((current) => ({ ...current, admissionFeeOverride: event.target.value }))} /></AdminField><AdminField label="活動日活動費用"><input type="number" min="0" value={runFields.activityExpense} disabled={!canManage} onChange={(event) => setRunFields((current) => ({ ...current, activityExpense: Number(event.target.value) || 0 }))} /></AdminField><AdminField label="活動日公司份額時數" hint="由開發人員或店經理設定；所有店員均可查看。"><input type="number" min="0" step="0.5" value={runFields.companyShareHours} disabled={!canManage} onChange={(event) => setRunFields((current) => ({ ...current, companyShareHours: event.target.value }))} /></AdminField></div>
        {canManage ? <div className="adminSettlementAddInput"><select defaultValue="" onChange={(event) => { const [staffId, role] = event.target.value.split("|"); if (staffId && role) addInput(staffId, role); event.target.value = ""; }}><option value="">新增人員角色輸入…</option>{availableStaff.flatMap((member) => ["designated", "service", "manager", "backstage"].map((role) => <option key={`${member.id}-${role}`} value={`${member.id}|${role}`}>{member.displayName} · {roleLabel[role]}</option>))}</select></div> : null}
        <div className="adminSettlementTableWrap"><table className="adminSettlementTable"><thead><tr><th>人員</th><th>角色</th><th>實際分鐘</th><th>計薪時數</th><th>活動日分配時數</th><th>出勤來源</th><th>公共小費</th><th>幕後參與</th></tr></thead><tbody>{inputs.map((item, index) => <tr key={`${item.staffId}-${item.role}`}><td>{item.displayName}</td><td>{roleLabel[item.role] || item.role}</td><td><input type="number" min="0" value={item.actualMinutes} disabled={!canManage || isFinalized} onChange={(event) => updateInput(index, "actualMinutes", Number(event.target.value) || 0)} /></td><td>{item.payableHours}</td><td><input type="number" min="0" step="0.5" value={item.activityHours ?? ""} disabled={!canManage || isFinalized} onChange={(event) => updateInput(index, "activityHours", event.target.value === "" ? null : Number(event.target.value))} /></td><td><select value={item.attendanceSource || "manual"} disabled={!canManage || isFinalized || item.attendanceSource === "backfill_approved"} onChange={(event) => updateInput(index, "attendanceSource", event.target.value)}><option value="manual">未核准</option><option value="clock">已由打卡帶入</option><option value="backfill_approved">補打卡已核准</option></select></td><td><span>{item.publicTipEligible ? "自動納入" : "不納入"}</span></td><td><input type="checkbox" checked={item.isBackstageParticipant} disabled={!canManage || isFinalized} onChange={(event) => updateInput(index, "isBackstageParticipant", event.target.checked)} /></td></tr>)}</tbody></table></div>
        {dayType === "event" ? <label className="adminSettlementConfirm"><input type="checkbox" checked={runFields.activityHoursConfirmed} disabled={!canManage || isFinalized} onChange={(event) => setRunFields((current) => ({ ...current, activityHoursConfirmed: event.target.checked }))} /> 我已確認活動日個人分配時數與公司份額時數。</label> : null}
      </AdminPanel>
      <AdminPanel title="補打卡申請與核准" description="活動日出席必須有打卡；補打卡需填寫理由並由開發人員或店經理核准。">
        <div className="adminFormGrid"><AdminField label="申請人員"><select value={backfillForm.staffId} onChange={(event) => setBackfillForm((current) => ({ ...current, staffId: event.target.value }))}><option value="">選擇人員</option>{availableStaff.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></AdminField><AdminField label="角色"><select value={backfillForm.role} onChange={(event) => setBackfillForm((current) => ({ ...current, role: event.target.value }))}>{["designated", "service", "manager", "backstage"].map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></AdminField><AdminField label="補打卡分鐘"><input type="number" min="1" value={backfillForm.requestedMinutes} onChange={(event) => setBackfillForm((current) => ({ ...current, requestedMinutes: event.target.value }))} /></AdminField><AdminField label="理由"><input value={backfillForm.reason} onChange={(event) => setBackfillForm((current) => ({ ...current, reason: event.target.value }))} /></AdminField></div>
        <AdminButton variant="secondary" onClick={() => void submitBackfill()} disabled={loading || saving || isFinalized}>提出補打卡</AdminButton>
        <div className="adminSettlementTableWrap"><table className="adminSettlementTable"><thead><tr><th>人員</th><th>角色</th><th>分鐘</th><th>理由</th><th>狀態</th><th>處理</th></tr></thead><tbody>{(overview.attendanceBackfillRequests || []).map((item) => <tr key={item.id}><td>{item.staffName || item.staffId}</td><td>{roleLabel[item.role] || item.role}</td><td>{item.requestedMinutes}</td><td>{item.reason}</td><td>{item.status}</td><td>{canManage && item.status === "pending" ? <><AdminButton variant="secondary" onClick={() => void reviewBackfill(item.id, true)} disabled={saving}>核准</AdminButton> <AdminButton variant="secondary" onClick={() => void reviewBackfill(item.id, false)} disabled={saving}>拒絕</AdminButton></> : "—"}</td></tr>)}</tbody></table></div>
      </AdminPanel>
      <AdminPanel title="薪資明細" description="底薪與營收分成擇優，小費獨立加計；每筆金額無條件進位，尾差由公司補貼。"><div className="adminSettlementTableWrap"><table className="adminSettlementTable"><thead><tr><th>人員</th><th>角色</th><th>底薪</th><th>營收分成</th><th>指定小費</th><th>公共小費</th><th>進位後應付</th><th>異常</th></tr></thead><tbody>{overview.results.map((item, index) => <tr key={`${item.staffId || "company"}-${item.role}-${index}`}><td>{item.displayName || item.staffId || "公司"}</td><td>{roleLabel[item.role] || item.role}</td><td>{money(item.basePay)} G</td><td>{money(item.revenueShare)} G</td><td>{money(item.designatedTip)} G</td><td>{money(item.publicTip)} G</td><td><strong>{money(item.afterRounding)} G</strong></td><td>{item.anomalyStatus !== "normal" ? item.anomalyNote || item.anomalyStatus : "—"}</td></tr>)}</tbody></table></div></AdminPanel>
      {canManage ? <AdminPanel title="可調整規則版本" description="規則以生效日期版本化；建立新版本不會改寫已完成結算使用的快照。金額最小支付單位固定為 1 Gil，不提供調整。"><div className="adminFormGrid">{([["dayType", "日期類型", "select"], ["effectiveFrom", "生效日期", "date"], ["designatedHourlyRate", "指名時薪", "number"], ["serviceManagerHourlyRate", "服務生／經理時薪", "number"], ["designatedSharePercentage", "指名分成 %", "number"], ["publicRoomStaffPercentage", "公共包廂指名 %", "number"], ["dedicatedRoomOwnerPercentage", "專屬包廂擁有者 %", "number"], ["serviceManagerPoolPercentage", "服務生／經理池 %", "number"], ["backstagePoolPercentage", "幕後池 %", "number"], ["companyPercentage", "公司收入 %", "number"]] as const).map(([key, label, type]) => <AdminField key={key} label={label}><>{type === "select" ? <select value={ruleForm[key]} onChange={(event) => setRuleForm((current) => ({ ...current, [key]: event.target.value }))}><option value="normal">非活動日</option><option value="event">活動日</option></select> : <input type={type as "date" | "number"} min="0" value={ruleForm[key]} onChange={(event) => setRuleForm((current) => ({ ...current, [key]: type === "date" ? event.target.value : Number(event.target.value) }))} />}</></AdminField>)}</div><AdminButton variant="secondary" onClick={saveRule} disabled={saving}>建立規則版本</AdminButton></AdminPanel> : null}
    </> : null}
  </AdminPage>;
}
