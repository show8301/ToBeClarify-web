"use client";

import { validatePublicTipPool } from "./public-tip-contract";

import { AdminRefreshButton } from "@/features/admin/shared/AdminRefreshButton";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SettlementBackfillReview, SettlementOverview, SettlementRule, SettlementRunFields, SettlementStaff, SettlementStaffInput, SettlementTab } from "./types";
import { getAdminBusinessDate } from "@/features/admin/shared/businessDay";
import { adminApi, adminRequest } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext";
import { AdminButton, AdminField, AdminPage, AdminPanel, AdminState } from "@/features/admin/shared/AdminShared.jsx";
import { AttendancePanel } from "./AttendancePanel";
import { SettlementTabs } from "./SettlementTabs";
import { SettlementSalaryDispatch } from "./SettlementSalaryDispatch";
import { SettlementOperations } from "./SettlementOperations";
import { SettlementPersonalAccounts } from "./SettlementPersonalAccounts";
import { parseSettlementRule } from "./rule-api";
import { SettlementRuleSettings } from "./SettlementRuleSettings";
import { SettlementPostActions } from "./SettlementPostActions";
import { SettlementBackfillReviewDialog } from "./SettlementBackfillReviewDialog";
import { settlementPeriodStatuses, settlementRoles as roleLabel, settlementStatuses } from "./presentation";
import { mergeRefreshedInputs } from "./refresh-inputs";
import type { RecalculationAdjustments } from "./recalculation-types";

type StaffInput = SettlementStaffInput;

const settlementTabs = new Set<SettlementTab>(["operations", "personal", "dispatch", "settings"]);

function isBusinessDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readSessionNo(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}

function isSessionNo(value: string | null): boolean {
  return value !== null && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}

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
  const searchParams = useSearchParams();
  const { user } = useAdminAuth();
  const canManage = user?.role === "developer" || user?.role === "manager";
  const requestedDate = searchParams.get("businessDate");
  const requestedSessionNo = searchParams.get("sessionNo");
  const requestedTab = searchParams.get("tab");
  const invalidParameters = [
    searchParams.has("businessDate") && !isBusinessDate(requestedDate) ? "營業日期" : "",
    searchParams.has("sessionNo") && !isSessionNo(requestedSessionNo) ? "營業時段" : "",
    searchParams.has("tab") && (!requestedTab || !settlementTabs.has(requestedTab as SettlementTab)) ? "分頁" : "",
  ].filter(Boolean);
  const [activeTab, setActiveTab] = useState<SettlementTab>(
    requestedTab && settlementTabs.has(requestedTab as SettlementTab)
      ? requestedTab as SettlementTab
      : canManage ? "operations" : "personal",
  );
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [date, setDate] = useState(() => isBusinessDate(requestedDate) ? requestedDate : "");
  const [flowVersion, setFlowVersion] = useState(1);
  const [sessionNo, setSessionNo] = useState(() => readSessionNo(requestedSessionNo));
  const [dayType, setDayType] = useState("normal");
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [staff, setStaff] = useState<SettlementStaff[]>([]);
  const [inputs, setInputs] = useState<StaffInput[]>([]);
  const [runFields, setRunFields] = useState<SettlementRunFields>({ publicTipAmount: 0, admissionFeeOverride: "", activityExpense: 0, companyShareHours: "", activityHoursConfirmed: false });
  const [selectedRule, setSelectedRule] = useState<SettlementRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Omit<SettlementRule, "id">>(emptyRule(null, "normal", ""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState(() => invalidParameters.length
    ? `分享連結中的${invalidParameters.join("、")}無效，已使用預設值。`
    : "");
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
  const refreshController = useRef<AbortController | null>(null);
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
      setOverview(validatePublicTipPool(nextOverview));
      setSelectedRule(null);
      setDayType(nextOverview.run.dayType || "normal");
      setInputs(nextOverview.staffInputs || []);
      setStaff(canManage ? (nextStaff || []) : (user?.staffMemberId ? [{ id: user.staffMemberId, displayName: user.displayName, isActive: true }] : []));
      setRunFields({
        publicTipAmount: 0, publicTipReconciliationReason: "",
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
    return () => {
      controller.abort();
      refreshController.current?.abort();
      loadSequence.current += 1;
    };
  }, [load]);

  const refreshSettlement = async (preserveDraftInputs = true) => {
    if (!date || !overview || loading) return false;
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    const sequence = ++loadSequence.current;
    const previous = overview.staffInputs || [];
    setSaving(true);
    setMessage("正在更新結算預覽；尚未保存的輸入會保留。");
    try {
      const next: SettlementOverview = await adminApi.getSettlement({ businessDate: date, sessionNo }, controller.signal);
      if (controller.signal.aborted || sequence !== loadSequence.current) return false;
      if (preserveDraftInputs) setInputs(current => mergeRefreshedInputs(current, previous, next.staffInputs || []));
      else { setInputs(next.staffInputs || []); setSelectedRule(null); setDayType(next.run.dayType); setRunFields(current => ({ ...current, publicTipReconciliationReason: "" })); }
      setOverview(validatePublicTipPool(next));
      setMessage("結算預覽已依最新出勤更新；尚未保存的輸入需保存後才會計入金額。");
      return true;
    } catch (nextError) {
      if (!controller.signal.aborted && sequence === loadSequence.current) {
        setMessage(`結算預覽刷新失敗：${(nextError as Error).message}。請重新整理結算資料。`);
      }
      return false;
    } finally {
      if (refreshController.current === controller) {
        refreshController.current = null;
        setSaving(false);
      }
    }
  };

  const updateInput = (index: number, key: keyof StaffInput, value: unknown) => {
    setInputs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };

  const addInput = (staffId: string, role: string) => {
    const assignment = overview?.payrollAssignments?.find(item => item.staffId === staffId);
    if (!assignment?.payrollRole || (role !== assignment.payrollRole && !(role === "backstage" && assignment.canUseBackstage))) return;
    const member = staff.find((item) => item.id === staffId);
    if (!member || inputs.some((item) => item.staffId === staffId && item.role === role)) return;
      setInputs((current) => [...current, {
      staffId, payrollSnapshotVersion: assignment.payrollSnapshotVersion, displayName: member.displayName, roleTitle: member.roleTitle, role,
      isWorking: Boolean(member.isWorkingToday), actualMinutes: 0, activityHours: null,
      payableHours: 0, publicTipEligible: true, isBackstageParticipant: role === "backstage", attendanceSource: "manual", note: "",
    }]);
  };

  const saveInputs = async () => {
    setSaving(true); setMessage("");
    try {
      const next = await adminApi.saveSettlementInputs({
        businessDate: date, sessionNo, dayType, ruleVersionId: selectedRule?.id ?? (dayType === overview?.run.dayType ? overview?.rule.id : null), ...runFields,
        admissionFeeOverride: runFields.admissionFeeOverride === "" ? null : Number(runFields.admissionFeeOverride),
        companyShareHours: runFields.companyShareHours === "" ? null : Number(runFields.companyShareHours),
        expectedInputVersion: overview?.run.inputVersion,
        staffInputs: inputs.map((item) => ({
          payrollSnapshotVersion: overview?.payrollAssignments?.find(assignment => assignment.staffId === item.staffId)?.payrollSnapshotVersion,
          staffId: item.staffId, role: item.role, actualMinutes: Number(item.actualMinutes || 0),
          activityHours: item.activityHours == null ? null : Number(item.activityHours),
          publicTipEligible: true, isBackstageParticipant: Boolean(item.isBackstageParticipant),
          attendanceSource: item.attendanceSource || "manual", note: item.note || null,
        })),
      });
      setOverview(validatePublicTipPool(next)); setSelectedRule(null); setInputs(next.staffInputs || inputs); setRunFields(current => ({ ...current, publicTipReconciliationReason: "" })); setMessage("結算輸入與規則版本已保存。");
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
        businessDate: date, sessionNo, dayType, staffId: selectedPersonId, role: overview?.payrollAssignments?.find(item => item.staffId === selectedPersonId)?.payrollRole,
        requestedMinutes, reason: backfillForm.reason.trim(),
      });
      setOverview(validatePublicTipPool(next)); setInputs(next.staffInputs || inputs);
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
      setOverview(validatePublicTipPool(next));
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
    try { const next = await adminApi.calculateSettlement({ businessDate: date, sessionNo }); setOverview(validatePublicTipPool(next)); setInputs(next.staffInputs || inputs); setMessage("已重新計算預覽，正式結算前仍可調整。"); }
    catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const closeBusinessDay = async () => {
    setSaving(true); setMessage("");
    try {
      const next = await adminApi.closeSettlement({ businessDate: date, operationId: crypto.randomUUID(), reason: "結束營業並停止新單" });
      setOverview(validatePublicTipPool(next)); setMessage("已停止新單並完成實際關店；未完成服務仍需逐筆協調。 ");
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
    if (!window.confirm("將保存本次結算版本；之後仍可調整計薪輸入，並於最終步驟建立新版。確定完成正式結算嗎？")) return;
    setSaving(true); setMessage("");
    try { const next = await adminApi.finalizeSettlement({ businessDate: date, sessionNo }); setOverview(validatePublicTipPool(next)); setMessage("本營業時段已正式結算；原版本已保留，可於同頁調整輸入並建立新版。"); }
    catch (nextError) { setMessage((nextError as Error).message); }
    finally { setSaving(false); }
  };

  const saveRule = async () => {
    setSaving(true); setMessage("");
    try {
      const saved = parseSettlementRule(await adminApi.saveSettlementRule({ ...ruleForm, effectiveFrom: ruleForm.effectiveFrom || date }));
      setRuleForm(emptyRule(saved, saved.dayType, saved.effectiveFrom));
      setMessage(`規則 ${saved.id.slice(0, 8)} 已儲存，生效日 ${saved.effectiveFrom}。可在版本列表查看並選用；既有正式結算尚未變更。`);
      return saved;
    } catch (nextError) { setMessage((nextError as Error).message); return null; }
    finally { setSaving(false); }
  };

  const availableStaff = useMemo(() => staff.filter(item => item.isActive !== false && (canManage || item.id === user?.staffMemberId)), [canManage, staff, user?.staffMemberId]);
  const isFinalized = overview?.run.status === "finalized";
  const tab = !canManage && (activeTab === "settings" || activeTab === "dispatch") ? "personal" : activeTab;
  const dirty = Boolean(overview && (
    (selectedRule !== null && selectedRule.id !== overview.rule.id) ||
    dayType !== overview.run.dayType ||
    JSON.stringify(inputs) !== JSON.stringify(overview.staffInputs || []) ||
    Boolean(runFields.publicTipReconciliationReason?.trim()) ||
    runFields.admissionFeeOverride !== (overview.run.admissionFeeOverride == null ? "" : String(overview.run.admissionFeeOverride)) ||
    runFields.activityExpense !== (overview.run.activityExpense || 0) ||
    runFields.companyShareHours !== (overview.run.companyShareHours == null ? "" : String(overview.run.companyShareHours)) ||
    runFields.activityHoursConfirmed !== Boolean(overview.run.activityHoursConfirmed)
  ));
  const recalculationAdjustments = useMemo<RecalculationAdjustments | undefined>(() => {
    if (!overview || overview.run.status !== "finalized") return undefined;
    const original = overview.staffInputs || [];
    const originalByKey = new Map(original.map(item => [`${item.staffId}|${item.role}`, item]));
    const currentByKey = new Map(inputs.map(item => [`${item.staffId}|${item.role}`, item]));
    const changedInputs = inputs.filter(item => {
      const before = originalByKey.get(`${item.staffId}|${item.role}`);
      return !before || before.actualMinutes !== item.actualMinutes
        || (before.activityHours ?? null) !== (item.activityHours ?? null)
        || before.isBackstageParticipant !== item.isBackstageParticipant;
    }).map(item => {
      const before = originalByKey.get(`${item.staffId}|${item.role}`);
      const isNew = !before;
      return {
        payrollSnapshotVersion: item.payrollSnapshotVersion ?? null,
        staffId: item.staffId, role: item.role, actualMinutes: item.actualMinutes,
        activityHours: item.activityHours ?? null, isBackstageParticipant: item.isBackstageParticipant,
        actualMinutesChanged: isNew || before!.actualMinutes !== item.actualMinutes,
        activityHoursChanged: isNew || (before!.activityHours ?? null) !== (item.activityHours ?? null),
        backstageParticipantChanged: isNew || before!.isBackstageParticipant !== item.isBackstageParticipant,
      };
    });
    const removedInputs = original.filter(item => !currentByKey.has(`${item.staffId}|${item.role}`))
      .map(item => ({ staffId: item.staffId, role: item.role }));
    const hasRunInputChanges = (selectedRule !== null && selectedRule.id !== overview.rule.id) || dayType !== overview.run.dayType
      || Boolean(runFields.publicTipReconciliationReason?.trim())
      || runFields.admissionFeeOverride !== (overview.run.admissionFeeOverride == null ? "" : String(overview.run.admissionFeeOverride))
      || runFields.activityExpense !== (overview.run.activityExpense || 0)
      || runFields.companyShareHours !== (overview.run.companyShareHours == null ? "" : String(overview.run.companyShareHours))
      || runFields.activityHoursConfirmed !== Boolean(overview.run.activityHoursConfirmed);
    if (!hasRunInputChanges && changedInputs.length === 0 && removedInputs.length === 0) return undefined;
    return {
      ruleVersionId: selectedRule?.id ?? null, dayType, publicTipAmount: 0,
      publicTipReconciliationReason: runFields.publicTipReconciliationReason,
      admissionFeeOverride: runFields.admissionFeeOverride === "" ? null : Number(runFields.admissionFeeOverride),
      activityExpense: runFields.activityExpense,
      companyShareHours: runFields.companyShareHours === "" ? null : Number(runFields.companyShareHours),
      activityHoursConfirmed: runFields.activityHoursConfirmed,
      staffInputs: changedInputs, removedStaffInputs: removedInputs,
    };
  }, [overview, inputs, dayType, runFields, selectedRule]);
  const selectPerson = (id: string) => {
    setSelectedStaffId(id);
    setBackfillForm(current => ({ ...current, requestedMinutes: "", reason: "" }));
  };
  const changeTab = (next: SettlementTab) => { setActiveTab(next); setMessage(""); };
  const personalRequests = (overview?.attendanceBackfillRequests || []).filter(item => item.staffId === selectedPersonId);

  useEffect(() => {
    if (!date) return;
    const url = new URL(window.location.href);
    const nextValues: [string, string][] = [
      ["businessDate", date],
      ["sessionNo", String(sessionNo)],
      ["tab", tab],
    ];
    let changed = false;
    for (const [key, value] of nextValues) {
      if (url.searchParams.get(key) === value) continue;
      url.searchParams.set(key, value);
      changed = true;
    }
    if (changed) window.history.replaceState(window.history.state, "", url);
  }, [date, sessionNo, tab]);

  return <AdminPage
    eyebrow="PAYROLL · SETTLEMENT"
    title="結算工作臺"
    description="營業日期、時段與目前分頁會保留在網址，方便分享相同查看範圍；資料仍依登入帳號權限載入。"
    actions={<AdminRefreshButton loading={loading} onClick={() => { setLoading(true); void load(); }} disabled={loading || saving} />}
  >
    <div className="adminSettlementWorkspace">
      <SettlementTabs active={tab} canManage={canManage} disabled={saving} onChange={changeTab} />
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
      {selectedRule && overview && selectedRule.id !== overview.rule.id ? <div className="adminNotice" role="status">待套用規則 {selectedRule.effectiveFrom} · {selectedRule.id.slice(0, 8)}；目前結算仍使用 {overview.rule.effectiveFrom} · {overview.rule.id.slice(0, 8)}。請在最終步驟預覽並保存新結果。</div> : null}
      {message ? <div className="adminNotice" role="status">{message}</div> : null}
      <AdminState loading={loading} error={error} onRetry={() => { setLoading(true); void load(); }} />
      {!loading && !error && overview ? <>
        <div id="settlement-panel-operations" role="tabpanel" aria-labelledby="settlement-tab-operations" hidden={tab !== "operations"} className="adminSettlementTabPanel" tabIndex={0}>
          <SettlementOperations
            key={`${date}-${sessionNo}`}
            overview={overview} inputs={inputs} staff={availableStaff} dayType={dayType} setDayType={next => { setDayType(next); setSelectedRule(null); }}
            fields={runFields} setFields={setRunFields} canManage={canManage} active={tab === "operations"} saving={saving} dirty={dirty} flowVersion={flowVersion}
            adjustments={recalculationAdjustments}
            onBusyChange={setSaving} onAttendanceChanged={refreshSettlement} onAdd={addInput} onRemove={(index) => setInputs(current => current.filter((_, itemIndex) => itemIndex !== index))} onInputChange={updateInput} onSave={saveInputs} onCalculate={calculate}
            onClose={closeBusinessDay} onFinalize={finalize} onReview={openBackfillReview}
            onRecalculated={async () => {
              const refreshed = await refreshSettlement(false);
              if (refreshed) setMessage("補正後重新結算完成，工時與薪資已更新；前後快照與支付紀錄已保留。");
              return refreshed;
            }}
            onViewPerson={id => { selectPerson(id); changeTab("personal"); }}
          >
            <SettlementPostActions staff={personalStaff} payment={paymentForm} setPayment={setPaymentForm} correction={correctionForm} setCorrection={setCorrectionForm} saving={saving} onPayment={recordPayment} onCorrection={recordCorrection} />
          </SettlementOperations>
        </div>
        <div id="settlement-panel-personal" role="tabpanel" aria-labelledby="settlement-tab-personal" hidden={tab !== "personal"} className="adminSettlementTabPanel" tabIndex={0}>
          <SettlementPersonalAccounts staff={personalStaff} selectedId={selectedPersonId} results={overview.results} inputs={overview.staffInputs} run={overview.run} summary={overview.summary} canManage={canManage} finalized={isFinalized} saving={saving} onSelect={selectPerson} />
          {selectedPersonId ? <AttendancePanel key={`${date}-${selectedPersonId}`} businessDate={date} staffId={selectedPersonId} canManage={canManage} locked={isFinalized} disabled={saving} active={tab === "personal"} onBusyChange={setSaving} onChanged={refreshSettlement} /> : null}
          <AdminPanel title="補打卡申請" description="填寫個人的出勤角色、分鐘與理由，送交開發人員或店經理核准。">
            {!isFinalized && availableStaff.some(member => member.id === selectedPersonId) ? <>
              <div className="adminFormGrid">
                <AdminField label="上班計薪職位"><input readOnly value={roleLabel[overview.payrollAssignments?.find(item => item.staffId === selectedPersonId)?.payrollRole || ""] || "待經理確認"} /></AdminField>
                <AdminField label="補打卡分鐘"><input type="number" min="1" value={backfillForm.requestedMinutes} disabled={saving} onChange={event => setBackfillForm(current => ({ ...current, requestedMinutes: event.target.value }))} /></AdminField>
                <AdminField label="申請理由"><input value={backfillForm.reason} disabled={saving} onChange={event => setBackfillForm(current => ({ ...current, reason: event.target.value }))} /></AdminField>
              </div>
              <div className="adminSettlementActionBar"><span>申請人員：{personalStaff.find(member => member.id === selectedPersonId)?.displayName}</span><AdminButton variant="secondary" disabled={saving} onClick={() => void submitBackfill()}>提出補打卡</AdminButton></div>
            </> : null}
            {personalRequests.length ? <div className="adminSettlementRequestList">{personalRequests.map(item => <article key={item.id}><div><strong>{roleLabel[item.role] || item.role} · {item.requestedMinutes} 分鐘</strong><p>{item.reason}</p></div><span className="adminSettlementBadge">{settlementStatuses[item.status] || item.status}</span></article>)}</div> : <p className="adminEmptyText">本時段沒有補打卡申請。</p>}
          </AdminPanel>
        </div>
        {canManage ? <div id="settlement-panel-dispatch" role="tabpanel" aria-labelledby="settlement-tab-dispatch" hidden={tab !== "dispatch"} className="adminSettlementTabPanel" tabIndex={0}>
          {tab === "dispatch" ? <SettlementSalaryDispatch
            key={`${date}-${sessionNo}-${overview.run.inputVersion}-${overview.run.correctionVersion}`}
            businessDate={date} sessionNo={sessionNo} onBusyChange={setSaving}
          /> : null}
        </div> : null}
        {canManage ? <div id="settlement-panel-settings" role="tabpanel" aria-labelledby="settlement-tab-settings" hidden={tab !== "settings"} className="adminSettlementTabPanel" tabIndex={0}>
          <SettlementRuleSettings key={`${date}-${sessionNo}`} rule={overview.rule} form={ruleForm} setForm={setRuleForm} saving={saving} onSave={saveRule}
            selected={selectedRule} businessDate={date} finalized={Boolean(isFinalized)} onCreate={value => setRuleForm(emptyRule(value, value.dayType, date))}
            onSelect={value => { setSelectedRule(value); setDayType(value?.dayType ?? overview.run.dayType); setMessage(value ? "規則版本已選取，請到營運結算預覽；尚未變更已結算金額。" : "已取消待套用的規則變更。"); }} />
        </div> : null}
      </> : null}
    </div>
    {backfillReview ? <SettlementBackfillReviewDialog
      key={`${backfillReview.request.id}-${backfillReview.approved}`}
      review={backfillReview} saving={saving} onClose={closeBackfillReview} onSubmit={reviewBackfill}
    /> : null}
  </AdminPage>;
}
