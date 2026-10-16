"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { StaffWorkStatusPanel } from "./StaffWorkStatusPanel";
import { TemporaryDutyPlanDialog } from "./TemporaryDutyPlanDialog";
import { useStaffingWorkspace } from "./staffingWorkspace";
import { StaffingAvailabilityHint } from "./StaffingAvailabilityHint";
import { intakeText, isApprovedShift, rosterPlans, shiftStatus, shiftText } from "./staffing";
import type { OperationsContext, OperationsDutyPlan, OperationsStaffMember } from "./operationsTypes";

type Props = { blockedReason?: string; onChanged: () => Promise<void>; navigate: (route: string) => void };
type Candidate = { value: string; label: string; staff: OperationsStaffMember; existing: OperationsDutyPlan | null };
type DraftSelection = Candidate & { context: OperationsContext; mode: "add" | "edit" };

export function ManagerStaffingPanel({ blockedReason = "", onChanged, navigate }: Props) {
  const { user, refresh: refreshAuthentication } = useAdminAuth();
  const canManage = user?.role === "manager" || user?.role === "developer";
  const accountKey = `${user?.id || ""}:${user?.role || ""}`;
  const workspace = useStaffingWorkspace(accountKey, canManage, refreshAuthentication);
  const data = workspace.data;
  const pickerId = useId();
  const reasonId = useId();
  const accordionName = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [message, setMessage] = useState("");
  const businessDate = data.context?.referenceBusinessDate || "";
  const resourceReason = !canManage ? "只有經理或開發者可管理排班，請確認登入帳號。"
    : blockedReason || (workspace.status === "loading" ? "正在讀取營業日、店員與班表，完成後即可搜尋。"
      : workspace.status === "error" ? workspace.error
        : !businessDate || !data.dutyPlans ? "人力資料尚未完整取得，請重新讀取。" : "");
  const unavailable = Boolean(resourceReason);
  const pickerReason = resourceReason || (draft ? "已有排班編輯視窗，請先完成或取消，再選取其他店員。"
    : "可搜尋未列入核准名單的既有店員；選取後確認時段與職位，儲存後核准。名單內的人員請展開後調班。");
  const plans = useMemo(() => rosterPlans(data.dutyPlans || [], data.staff, businessDate, data.refreshedAt), [data.dutyPlans, data.staff, businessDate, data.refreshedAt]);
  const staffById = useMemo(() => new Map(data.staff.map((staff) => [staff.id, staff])), [data.staff]);
  const candidates = useMemo<Candidate[]>(() => {
    const rosterIds = new Set(plans.map((plan) => plan.staffId));
    const names = new Map<string, number>();
    data.staff.forEach((staff) => names.set(staff.displayName, (names.get(staff.displayName) || 0) + 1));
    return data.staff.filter((staff) => !rosterIds.has(staff.id)).map((staff) => {
      const existing = data.dutyPlans?.find((plan) => plan.staffId === staff.id && plan.businessDate === businessDate) || null;
      const note = !existing ? "未排班" : existing.approvalStatus === "pending" ? "待核准" : existing.approvalStatus === "rejected" ? "已退回" : !existing.isWorking ? "休假" : "時段待確認";
      const name = (names.get(staff.displayName) || 0) > 1 ? `${staff.displayName}（${staff.id.slice(-6)}）` : staff.displayName;
      return { value: staff.id, label: `${name}${staff.roleTitle ? ` · ${staff.roleTitle}` : ""} · ${note}${staff.isActive ? "" : " · 未公開"}`, staff, existing };
    });
  }, [plans, data.staff, data.dutyPlans, businessDate]);
  const incompleteCount = data.dutyPlans?.filter((plan) => plan.businessDate === businessDate && plan.isWorking && plan.approvalStatus === "approved" && !isApprovedShift(plan)).length || 0;
  const workingCount = new Set(plans.filter((plan) => shiftStatus(plan, staffById.get(plan.staffId), data.refreshedAt) === "執勤中").map((plan) => plan.staffId)).size;

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = savedScroll.current;
  }, [data.dutyPlans, data.staff]);

  const closeDraft = () => { setDraft(null); setQuery(""); };
  const refreshStaffing = async () => {
    await workspace.reload();
    // Other dashboard reads may fail or be slow; they do not hold the staffing form lock.
    void onChanged().catch(() => { /* The parent reports its own read failure. */ });
  };

  return <AdminPanel
    className="adminStaffingPanel"
    title="當班人力"
    description="顯示已核准的上班班次；展開店員可調整接單與本班職位。"
    actions={<><AdminButton variant="ghost" disabled={!canManage || workspace.refreshing || Boolean(draft)} onClick={() => void workspace.reload()}>重新讀取人力</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/duty-planning")}>值班規劃</AdminButton></>}
  >
    <div className="adminStaffingToolbar">
      <div className="adminStaffingCounts"><strong>營業日 {businessDate || "讀取中…"}</strong><span>{data.dutyPlans ? unavailable ? `上次核准 ${plans.length} 班 · 狀態待確認` : `核准 ${plans.length} 班 · 執勤 ${workingCount} 人` : "班表尚未確認"}</span></div>
      <Combobox.Root<Candidate>
        items={candidates}
        value={null}
        inputValue={query}
        disabled={unavailable || Boolean(draft)}
        autoHighlight
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        filter={(item, search) => item.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())}
        onInputValueChange={setQuery}
        onValueChange={(item) => { if (item && data.context && !unavailable) { setDraft({ ...item, context: data.context, mode: "add" }); setMessage(""); } }}
      >
        <div className="adminStaffingPickerHeading">
          <label htmlFor={pickerId} className="adminStaffingPickerLabel">加入臨時排班</label>
          <StaffingAvailabilityHint reason={pickerReason} />
        </div>
        <span id={reasonId} className="adminVisuallyHidden">{pickerReason}</span>
        <Combobox.InputGroup className="adminStaffingPicker">
          <Combobox.Input id={pickerId} placeholder="輸入店員姓名搜尋…" aria-label="搜尋未排班店員" aria-describedby={reasonId} />
          <Combobox.Trigger aria-label="顯示未排班店員"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal className="adminTheme adminStaffingPortal">
          <Combobox.Positioner sideOffset={6} align="start" className="adminStaffingPickerPositioner">
            <Combobox.Popup className="adminStaffingPickerPopup">
              <Combobox.Empty className="adminStaffingPickerEmpty">沒有符合的未排班店員。</Combobox.Empty>
              <Combobox.List>{(item: Candidate) => <Combobox.Item key={item.value} value={item} className="adminStaffingPickerItem">{item.label}</Combobox.Item>}</Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <p className="adminWorkStatusHint">選取店員後確認時段與職位，儲存核准才會加入名單。</p>
      {workspace.refreshing && <span className="adminWorkStatusHint" role="status">人力資料更新中…</span>}
      {workspace.status === "error" && <p className="adminFormError" role="alert">{workspace.error}</p>}
      {incompleteCount > 0 && <p className="adminFormError" role="alert">有 {incompleteCount} 筆核准班表缺少有效時段，請至值班規劃確認。</p>}
      {message && <p role="status">{message}</p>}
    </div>
    <div ref={scrollRef} className="adminStaffingScroll" role="region" aria-label="核准排班員工清單" onScroll={(event) => { savedScroll.current = event.currentTarget.scrollTop; }}>
      <div className="adminWorkStatusRoster">
        {plans.map((plan) => {
          const staff = staffById.get(plan.staffId);
          const matchingDay = staff?.todayWorkMode?.businessDate === plan.businessDate;
          return <details key={plan.id} name={accordionName} className="adminWorkStatusStaff">
            <AdminDisclosureSummary className="adminWorkStatusStaffSummary">
              <span className="adminWorkStatusStaffIdentity">
                <strong>{staff?.displayName || plan.staffName}</strong>
                <span>{unavailable ? "狀態待確認" : `${shiftStatus(plan, staff, data.refreshedAt)} · ${matchingDay ? intakeText(staff) : "接單狀態屬其他營業日"}`}</span>
                <small className="adminStaffingShift">{shiftText(plan)}{plan.businessDate !== businessDate ? ` · 跨日執勤（${plan.businessDate}）` : ""}</small>
              </span>
            </AdminDisclosureSummary>
            {staff && matchingDay ? <StaffWorkStatusPanel staff={staff} disabled={unavailable || Boolean(draft)} onChanged={refreshStaffing} /> : <p className="adminWorkStatusHint">{staff ? "此班次與目前可操作的工作狀態日期不同，請至值班規劃確認。" : "店員資料暫無法取得，請重新整理。"}</p>}
            {staff && plan.businessDate === businessDate && data.context && <AdminButton variant="secondary" disabled={unavailable || Boolean(draft)} onClick={() => {
              if (data.context) { setDraft({ value: staff.id, label: staff.displayName, staff, existing: plan, context: data.context, mode: "edit" }); setMessage(""); }
            }}>調班／休假／提前下班</AdminButton>}
          </details>;
        })}
        {!plans.length && <p className="adminRoleDashboardEmpty">{data.dutyPlans ? "此營業日尚無核准上班班次，可從上方加入臨時排班。" : "尚未取得核准班表，請重新整理。"}</p>}
      </div>
    </div>
    {draft && <TemporaryDutyPlanDialog
      key={`${draft.mode}:${draft.value}:${draft.context.referenceBusinessDate}`}
      mode={draft.mode}
      disabledReason={resourceReason || (draft.context.referenceBusinessDate !== businessDate ? "營業日已變更，請關閉視窗並重新選取。" : "")}
      staff={draft.staff}
      context={draft.context}
      existing={draft.existing}
      onClose={closeDraft}
      onChanged={refreshStaffing}
      onSaved={(name) => { closeDraft(); setMessage(`${name} 在 ${draft.context.referenceBusinessDate} 的班次已儲存並核准。`); }}
    />}
  </AdminPanel>;
}
