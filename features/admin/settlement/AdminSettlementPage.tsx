"use client";

import { AdminRefreshButton } from "@/features/admin/shared/AdminRefreshButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SettlementBackfillReview, SettlementOverview, SettlementRule, SettlementRunFields, SettlementStaff, SettlementStaffInput, SettlementTab } from "./types";
import { getAdminBusinessDate } from "@/features/admin/shared/businessDay";
import { adminApi, adminRequest } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminButton, AdminField, AdminPage, AdminPanel, AdminState } from "@/features/admin/shared/AdminShared.jsx";
import { AttendancePanel } from "./AttendancePanel";
import { SettlementTabs } from "./SettlementTabs";
import { SettlementOperations } from "./SettlementOperations";
import { SettlementPersonalAccounts } from "./SettlementPersonalAccounts";
import { SettlementRuleSettings } from "./SettlementRuleSettings";
import { SettlementPostActions } from "./SettlementPostActions";
import { SettlementBackfillReviewDialog } from "./SettlementBackfillReviewDialog";
import { settlementPeriodStatuses, settlementRoles as roleLabel, settlementStatuses } from "./presentation";

type StaffInput = SettlementStaffInput;

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
  const [activeTab, setActiveTab] = useState<SettlementTab>(canManage ? "operations" : "personal");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [date, setDate] = useState("");
  const [flowVersion, setFlowVersion] = useState(1);
  const [sessionNo, setSessionNo] = useState(1);
  const [dayType, setDayType] = useState("normal");
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [staff, setStaff] = useState<SettlementStaff[]>([]);
  const [inputs, setInputs] = useState<StaffInput[]>([]);
  const [runFields, setRunFields] = useState<SettlementRunFields>({ publicTipAmount: 0, admissionFeeOverride: "", activityExpense: 0, companyShareHours: "", activityHoursConfirmed: false });
  const [ruleForm, setRuleForm] = useState<Omit<SettlementRule, "id">>(emptyRule(null, "normal", ""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  const [backfillForm, setBackfillForm] = useState({ role: "designated", requestedMinutes: "", reason: "" });
  const [paymentForm, setPaymentForm] = useState({ staffId: "", eventKind: "payout", amount: "", reason: "" });
  const [correctionForm, setCorrectionForm] = useState({ sourceKind: "finance", sourceId: "", staffId: "", amountDelta: "", reason: "" });
  const [backfillReview, setBackfillReview] = useState<SettlementBackfillReview | null>(null);
  const reviewInFlight = useRef(false);

  const personalStaff = useMemo(() => {
    const members = new Map(staff.map(member => [member.id, member]));
    for (const item of overview?.staffInputs || []) {
      if (!members.has(item.staffId)) members.set(item.staffId, { id: item.staffId, displayName: item.displayName, isActive: false });
    }
    for (const item of overview?.results || []) {
      if (item.staffId && !members.has(item.staffId)) members.set(item.staffId, { id: item.staffId, displayName: item.displayName || item.staffId, isActive: false });
    }
    return [...members.values()].filter(member => canManage || member.id === user?.staffMemberId);
  }, [staff, overview, canManage, user?.staffMemberId]);
  const selectedPersonId = personalStaff.some(member => member.id === selectedStaffId) ? selectedStaffId
    : personalStaff.find(member => member.id === user?.staffMemberId)?.id || personalStaff[0]?.id || "";

  const loadSequence = useRef(0);
  const load = useCallback((signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    if (!date) {
      return getAdminBusinessDate(signal).then((businessDate) => {
        if (!signal?.aborted && sequence === loadSequence.current) setDate(businessDate);
      }).catch((nextError: unknown) => {
        if (!signal?.aborted && sequence === loadSequence.current) { setError(nextError as Error); setLoading(false); }
      });
    }
    return Promise.all([
        adminApi.getSettlement({ businessDate: date, sessionNo }, signal),
        canManage ? adminApi.getStaffMembers(signal) : Promise.resolve([]),
        adminRequest(`/business-day-plans/${date}/context`, { signal }),
      ]).then(([nextOverview, nextStaff, dayContext]) => {
      if (signal?.aborted || sequence !== loadSequence.current) return;
      setError(null);
      if (!dayContext || typeof dayContext.flowVersion !== "number") throw new Error("無法確認營業日模式。");
      setFlowVersion(dayContext.flowVersion);
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
    const requestedMinutes = Number(backfillForm.requestedMinutes);
    if (!selectedPersonId || !Number.isFinite(requestedMinutes) || requestedMinutes <= 0 || !backfillForm.reason.trim()) {
      setMessage("補打卡申請需要人員、分鐘數與理由。");
      return;
    }
    setSaving(true); setMessage("");
    try {
      const next = await adminApi.submitSettlementAttendanceBackfill({
        businessDate: date, sessionNo, dayType, staffId: selectedPersonId, role: backfillForm.role,
        requestedMinutes, reason: backfillForm.reason.trim(),
      });
      setOverview(next); setInputs(next.staffInputs || inputs);
      setBackfillForm((current) => ({ ...current, requestedMinutes: "", reason: "" }));
      setMessage("補打卡申請已送出，待開發人員或店經理核准。");
    } catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const openBackfillReview = (requestId: string, approved: boolean) => {
    if (!canManage || loading || saving || overview?.run.status === "finalized") return;
    const request = overview?.attendanceBackfillRequests?.find(item => item.id === requestId && item.status === "pending");
    if (!request) { setMessage("這筆補打卡已不在待核准清單，請重新載入。"); return; }
    setBackfillReview({ request, approved, businessDate: date, sessionNo });
  };

  const closeBackfillReview = () => {
    if (!saving && !reviewInFlight.current) setBackfillReview(null);
  };

  const reviewBackfill = async (note: string) => {
    if (reviewInFlight.current) return;
    if (!backfillReview || !canManage || saving || loading || overview?.run.status === "finalized"
      || backfillReview.businessDate !== date || backfillReview.sessionNo !== sessionNo
      || !overview?.attendanceBackfillRequests?.some(item => item.id === backfillReview.request.id && item.status === "pending")) {
      throw new Error("目前已無法審核這筆申請，請關閉視窗並重新載入。");
    }
    if (!backfillReview.approved && !note.trim()) throw new Error("請填寫拒絕原因。");
    reviewInFlight.current = true;
    setSaving(true);
    setMessage("");
    try {
      const next = await adminApi.reviewSettlementAttendanceBackfill(backfillReview.request.id, {
        businessDate: backfillReview.businessDate, sessionNo: backfillReview.sessionNo,
        approved: backfillReview.approved, note: note.trim() || null,
      });
      setOverview(next);
      setInputs(next.staffInputs || inputs);
      setMessage(backfillReview.approved ? "補打卡已核准。" : "補打卡已拒絕。");
      setBackfillReview(null);
    } finally {
      reviewInFlight.current = false;
      setSaving(false);
    }
  };

  const calculate = async () => {
    setSaving(true); setMessage("");
    try { const next = await adminApi.calculateSettlement({ businessDate: date, sessionNo }); setOverview(next); setInputs(next.staffInputs || inputs); setMessage("已重新計算預覽，正式結算前仍可調整。"); }
    catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const closeBusinessDay = async () => {
    setSaving(true); setMessage("");
    try {
      const next = await adminApi.closeSettlement({ businessDate: date, operationId: crypto.randomUUID(), reason: "結束營業並停止新單" });
      setOverview(next); setMessage("已停止新單並完成實際關店；未完成服務仍需逐筆協調。 ");
    } catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const recordPayment = async () => {
    if (!paymentForm.staffId || Number(paymentForm.amount) <= 0 || !paymentForm.reason.trim()) { setMessage("支付需要人員、金額與原因。"); return; }
    setSaving(true); setMessage("");
    try {
      await adminApi.recordSettlementPayment({ businessDate: date, sessionNo, staffId: paymentForm.staffId, eventKind: paymentForm.eventKind, amount: Number(paymentForm.amount), operationId: crypto.randomUUID(), reason: paymentForm.reason.trim() });
      setPaymentForm(current => ({ ...current, amount: "", reason: "" })); setMessage("支付／追回已記錄；重送同一操作不會重複入帳。");
    } catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const recordCorrection = async () => {
    if (!Number(correctionForm.amountDelta) || !correctionForm.reason.trim()) { setMessage("結算後更正需要非零差額與原因。"); return; }
    setSaving(true); setMessage("");
    try {
      await adminApi.recordSettlementCorrection({ businessDate: date, sessionNo, sourceKind: correctionForm.sourceKind, sourceId: correctionForm.sourceId || null, staffId: correctionForm.staffId || null, amountDelta: Number(correctionForm.amountDelta), operationId: crypto.randomUUID(), reason: correctionForm.reason.trim() });
      setCorrectionForm(current => ({ ...current, sourceId: "", amountDelta: "", reason: "" })); setMessage("結算後更正已建立差額案件，歷史快照保持不變。");
    } catch (nextError) { setMessage((nextError as Error).message); }
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

  const availableStaff = useMemo(() => staff.filter(item => item.isActive !== false && (canManage || item.id === user?.staffMemberId)), [canManage, staff, user?.staffMemberId]);
  const isFinalized = overview?.run.status === "finalized";
  const tab = !canManage && activeTab === "settings" ? "personal" : activeTab;
  const dirty = Boolean(overview && (
    dayType !== overview.run.dayType ||
    JSON.stringify(inputs) !== JSON.stringify(overview.staffInputs || []) ||
    runFields.publicTipAmount !== (overview.run.publicTipAmount || 0) ||
    runFields.admissionFeeOverride !== (overview.run.admissionFeeOverride == null ? "" : String(overview.run.admissionFeeOverride)) ||
    runFields.activityExpense !== (overview.run.activityExpense || 0) ||
    runFields.companyShareHours !== (overview.run.companyShareHours == null ? "" : String(overview.run.companyShareHours)) ||
    runFields.activityHoursConfirmed !== Boolean(overview.run.activityHoursConfirmed)
  ));
  const selectPerson = (id: string) => {
    setSelectedStaffId(id);
    setBackfillForm(current => ({ ...current, requestedMinutes: "", reason: "" }));
  };
  const changeTab = (next: SettlementTab) => { setActiveTab(next); setMessage(""); };
  const personalRequests = (overview?.attendanceBackfillRequests || []).filter(item => item.staffId === selectedPersonId);

  return <AdminPage
    eyebrow="PAYROLL · SETTLEMENT"
    title="結算工作台"
    description="營運結算、個人帳目與規則設定，依工作目的分開處理。"
    actions={<AdminRefreshButton onClick={() => { setLoading(true); void load(); }} disabled={loading || saving} />}
  >
    <div className="adminSettlementWorkspace">
      <SettlementTabs active={tab} canManage={canManage} onChange={changeTab} />
      <div className="adminSettlementContext">
        <AdminField label="營業日期"><input type="date" value={date} disabled={saving} onChange={event => {
          if (!event.target.value || event.target.value === date) return;
          setLoading(true); setMessage(""); setDate(event.target.value);
        }} /></AdminField>
        <AdminField label="營業時段"><input type="number" min="1" step="1" value={sessionNo} disabled={saving} onChange={event => {
          const next = Math.max(1, Math.floor(Number(event.target.value) || 1));
          if (next === sessionNo) return;
          setLoading(true); setMessage(""); setSessionNo(next);
        }} /></AdminField>
        {!loading && !error && overview ? <div className="adminSettlementContextStatus">
          <span>{overview.run.dayType === "event" ? "活動日" : "非活動日"}</span>
          {overview.workflow ? <span>{settlementPeriodStatuses[overview.workflow.periodStatus] || overview.workflow.periodStatus}</span> : null}
          <span className="adminSettlementBadge">{settlementStatuses[overview.run.status] || overview.run.status}</span>
        </div> : null}
      </div>
      {message ? <div className="adminNotice" role="status">{message}</div> : null}
      <AdminState loading={loading} error={error} onRetry={() => { setLoading(true); void load(); }} />
      {!loading && !error && overview ? <>
        <div id="settlement-panel-operations" role="tabpanel" aria-labelledby="settlement-tab-operations" hidden={tab !== "operations"} className="adminSettlementTabPanel" tabIndex={0}>
          <SettlementOperations
            key={`${date}-${sessionNo}`}
            overview={overview} inputs={inputs} staff={availableStaff} dayType={dayType} setDayType={setDayType}
            fields={runFields} setFields={setRunFields} canManage={canManage} active={tab === "operations"} saving={saving} dirty={dirty} flowVersion={flowVersion}
            onBusyChange={setSaving} onAdd={addInput} onInputChange={updateInput} onSave={saveInputs} onCalculate={calculate}
            onClose={closeBusinessDay} onFinalize={finalize} onReopen={reopen} onReview={openBackfillReview}
            onViewPerson={id => { selectPerson(id); changeTab("personal"); }}
          >
            <SettlementPostActions staff={personalStaff} payment={paymentForm} setPayment={setPaymentForm} correction={correctionForm} setCorrection={setCorrectionForm} saving={saving} onPayment={recordPayment} onCorrection={recordCorrection} />
          </SettlementOperations>
        </div>
        <div id="settlement-panel-personal" role="tabpanel" aria-labelledby="settlement-tab-personal" hidden={tab !== "personal"} className="adminSettlementTabPanel" tabIndex={0}>
          <SettlementPersonalAccounts staff={personalStaff} selectedId={selectedPersonId} results={overview.results} inputs={inputs} canManage={canManage} finalized={isFinalized} saving={saving} onSelect={selectPerson} />
          {selectedPersonId ? <AttendancePanel key={`${date}-${selectedPersonId}`} businessDate={date} staffId={selectedPersonId} canManage={canManage} locked={isFinalized} disabled={saving} active={tab === "personal"} onBusyChange={setSaving} /> : null}
          <AdminPanel title="補打卡申請" description="填寫個人的出勤角色、分鐘與理由，送交開發人員或店經理核准。">
            {!isFinalized && availableStaff.some(member => member.id === selectedPersonId) ? <>
              <div className="adminFormGrid">
                <AdminField label="角色"><select value={backfillForm.role} disabled={saving} onChange={event => setBackfillForm(current => ({ ...current, role: event.target.value }))}>{["designated", "service", "manager", "backstage"].map(role => <option key={role} value={role}>{roleLabel[role]}</option>)}</select></AdminField>
                <AdminField label="補打卡分鐘"><input type="number" min="1" value={backfillForm.requestedMinutes} disabled={saving} onChange={event => setBackfillForm(current => ({ ...current, requestedMinutes: event.target.value }))} /></AdminField>
                <AdminField label="申請理由"><input value={backfillForm.reason} disabled={saving} onChange={event => setBackfillForm(current => ({ ...current, reason: event.target.value }))} /></AdminField>
              </div>
              <div className="adminSettlementActionBar"><span>申請人員：{personalStaff.find(member => member.id === selectedPersonId)?.displayName}</span><AdminButton variant="secondary" disabled={saving} onClick={() => void submitBackfill()}>提出補打卡</AdminButton></div>
            </> : null}
            {personalRequests.length ? <div className="adminSettlementRequestList">{personalRequests.map(item => <article key={item.id}><div><strong>{roleLabel[item.role] || item.role} · {item.requestedMinutes} 分鐘</strong><p>{item.reason}</p></div><span className="adminSettlementBadge">{settlementStatuses[item.status] || item.status}</span></article>)}</div> : <p className="adminEmptyText">本時段沒有補打卡申請。</p>}
          </AdminPanel>
        </div>
        {canManage ? <div id="settlement-panel-settings" role="tabpanel" aria-labelledby="settlement-tab-settings" hidden={tab !== "settings"} className="adminSettlementTabPanel" tabIndex={0}>
          <SettlementRuleSettings rule={overview.rule} form={ruleForm} setForm={setRuleForm} saving={saving} onSave={saveRule} />
        </div> : null}
      </> : null}
    </div>
    {backfillReview ? <SettlementBackfillReviewDialog
      key={`${backfillReview.request.id}-${backfillReview.approved}`}
      review={backfillReview} saving={saving} onClose={closeBackfillReview} onSubmit={reviewBackfill}
    /> : null}
  </AdminPage>;
}
