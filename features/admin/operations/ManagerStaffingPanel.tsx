"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { AdminButton, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { StaffWorkStatusPanel } from "./StaffWorkStatusPanel";
import { TemporaryDutyPlanDialog } from "./TemporaryDutyPlanDialog";
import { intakeText, isApprovedShift, rosterPlans, shiftStatus, shiftText } from "./staffing";
import type { OperationsContext, OperationsData, OperationsDutyPlan, OperationsStaffMember } from "./operationsTypes";

type Props = { data: OperationsData; disabled: boolean; onChanged: () => Promise<void>; navigate: (route: string) => void };
type Candidate = { value: string; label: string; staff: OperationsStaffMember; existing: OperationsDutyPlan | null };
type DraftSelection = Candidate & { context: OperationsContext };

export function ManagerStaffingPanel({ data, disabled, onChanged, navigate }: Props) {
  const pickerId = useId();
  const accordionName = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [message, setMessage] = useState("");
  const businessDate = data.context?.referenceBusinessDate || "";
  const unavailable = disabled || !businessDate || !data.dutyPlans || Boolean(data.dutyPlansError);
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

  return <AdminPanel
    className="adminStaffingPanel"
    title="當班人力"
    description="顯示已核准的上班班次；展開店員可調整接單與本班職位。"
    actions={<AdminButton variant="ghost" onClick={() => navigate("/admin/duty-planning")}>值班規劃</AdminButton>}
  >
    <div className="adminStaffingToolbar">
      <div className="adminStaffingCounts"><strong>營業日 {businessDate || "讀取中…"}</strong><span>{data.dutyPlans ? `核准 ${plans.length} 班 · 執勤 ${workingCount} 人` : "班表尚未確認"}</span></div>
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
        onValueChange={(item) => { if (item && data.context) { setDraft({ ...item, context: data.context }); setMessage(""); } }}
      >
        <label htmlFor={pickerId} className="adminStaffingPickerLabel">加入臨時排班</label>
        <Combobox.InputGroup className="adminStaffingPicker">
          <Combobox.Input id={pickerId} placeholder="輸入店員姓名搜尋…" aria-label="搜尋未排班店員" />
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
      {data.dutyPlansError && <p className="adminFormError" role="alert">班表無法更新：{data.dutyPlansError}</p>}
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
                <span>{shiftStatus(plan, staff, data.refreshedAt)} · {matchingDay ? intakeText(staff) : "接單狀態屬其他營業日"}</span>
                <small className="adminStaffingShift">{shiftText(plan)}{plan.businessDate !== businessDate ? ` · 跨日執勤（${plan.businessDate}）` : ""}</small>
              </span>
            </AdminDisclosureSummary>
            {staff && matchingDay ? <StaffWorkStatusPanel staff={staff} disabled={unavailable} onChanged={onChanged} /> : <p className="adminWorkStatusHint">{staff ? "此班次與目前可操作的工作狀態日期不同，請至值班規劃確認。" : "店員資料暫無法取得，請重新整理。"}</p>}
          </details>;
        })}
        {!plans.length && <p className="adminRoleDashboardEmpty">{data.dutyPlans ? "此營業日尚無核准上班班次，可從上方加入臨時排班。" : "尚未取得核准班表，請重新整理。"}</p>}
      </div>
    </div>
    {draft && <TemporaryDutyPlanDialog
      key={`${draft.value}:${draft.context.referenceBusinessDate}`}
      staff={draft.staff}
      context={draft.context}
      existing={draft.existing}
      onClose={closeDraft}
      onChanged={onChanged}
      onSaved={(name) => { closeDraft(); setMessage(`${name} 在 ${draft.context.referenceBusinessDate} 的班次已儲存並核准。`); }}
    />}
  </AdminPanel>;
}
