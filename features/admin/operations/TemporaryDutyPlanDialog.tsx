"use client";

import { useEffect, useId, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { getAdminBusinessDate } from "@/features/admin/shared/businessDay";
import { AdminButton, AdminDialog, AdminField, AdminToggle } from "@/features/admin/shared/AdminShared.jsx";
import { dutyPlanRevision, isApprovedShift, parseDutyPlan, parseDutyPlans } from "./staffing";
import { workRoleOptions } from "./staffWorkStatus";
import type { OperationsContext, OperationsDutyPlan, OperationsStaffMember, WorkRole } from "./operationsTypes";

type Props = {
  staff: OperationsStaffMember;
  context: OperationsContext;
  existing: OperationsDutyPlan | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onSaved: (name: string) => void;
};

function referenceClock(value: string, businessDate: string, start = false): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  if (start && day !== businessDate) {
    const hour = Number(clock.slice(0, 2));
    return day > businessDate && hour < 4 ? `${hour + 24}${clock.slice(2)}` : "";
  }
  return clock;
}

function validClock(value: string): boolean {
  return /^(?:[01]\d|2[0-7]):[0-5]\d$/.test(value);
}

export function TemporaryDutyPlanDialog({ staff, context, existing, onClose, onChanged, onSaved }: Props) {
  const formId = useId();
  const businessDate = context.referenceBusinessDate;
  const [startTime, setStartTime] = useState(existing?.startTime || referenceClock(context.referenceStartsAt, businessDate, true));
  const [endTime, setEndTime] = useState(existing?.endTime || referenceClock(context.referenceEndsAt, businessDate));
  const [roles, setRoles] = useState<WorkRole[]>(existing?.scheduledRoles.length ? [...existing.scheduledRoles] : ["service"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsReselect, setNeedsReselect] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const initialRevision = useRef(dutyPlanRevision(existing));

  useEffect(() => () => requestRef.current?.abort(), []);

  const save = async () => {
    if (requestRef.current || needsReselect) return;
    if (!validClock(startTime) || !validClock(endTime)) { setError("請輸入 00:00～27:59 之間的時間，例如 20:00 或 26:00。"); return; }
    if (startTime === endTime) { setError("開始與結束時間不可相同。"); return; }
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const start = minutes(startTime);
    const end = minutes(endTime) + (minutes(endTime) <= start ? 1440 : 0);
    if (end <= start || end - start > 1440) { setError("請確認班次起訖時間，單一班次須在 24 小時內結束。"); return; }
    if (!roles.length) { setError("請至少選擇一個排班職位。"); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    let submitted = false;
    let saved = false;
    try {
      const currentDate = await getAdminBusinessDate(controller.signal);
      if (currentDate !== businessDate) {
        setNeedsReselect(true);
        throw new Error("營業日已變更，請關閉視窗並確認新日期後重新選取。");
      }
      const plans = parseDutyPlans(await adminApi.getDutyPlans({ from: businessDate, to: businessDate }, controller.signal));
      const current = plans.find((plan) => plan.staffId === staff.id) || null;
      if (dutyPlanRevision(current) !== initialRevision.current || (current && isApprovedShift(current))) {
        setNeedsReselect(true);
        throw new Error("這位店員的班表已更新，請關閉視窗並確認最新班表，避免覆蓋其他修改。");
      }
      const body = { staffId: staff.id, businessDate, isWorking: true, startTime, endTime, scheduledRoles: roles };
      submitted = true;
      const result: unknown = current
        ? await adminApi.updateDutyPlan(current.id, body, controller.signal)
        : await adminApi.createDutyPlan(body, controller.signal);
      const plan = parseDutyPlan(result);
      if (!plan || plan.staffId !== staff.id || plan.businessDate !== businessDate || !isApprovedShift(plan)) {
        throw new Error("已送出排班，但無法確認核准結果，請先重新讀取班表確認。");
      }
      saved = true;
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (submitted) setNeedsReselect(true);
        setError(cause instanceof Error ? cause.message : "臨時排班儲存失敗。");
      }
    } finally {
      if (!controller.signal.aborted) {
        try {
          await onChanged();
        } catch {
          if (!controller.signal.aborted) setError("無法重新讀取最新班表，請重新整理確認結果。");
        } finally {
          if (!controller.signal.aborted) {
            requestRef.current = null;
            setBusy(false);
            if (saved) onSaved(staff.displayName);
          }
        }
      }
    }
  };

  return <AdminDialog
    open
    title={`${existing ? "調整既有班表" : "加入臨時排班"}：${staff.displayName}`}
    description="確認時段與職位後，經理儲存即核准；上班打卡與實際接單資格仍依原有規則處理。"
    className="adminTemporaryDutyDialog"
    onClose={() => { if (!requestRef.current) onClose(); }}
    actions={<><AdminButton variant="ghost" disabled={busy} onClick={onClose}>取消</AdminButton><AdminButton type="submit" form={formId} disabled={busy || needsReselect}>{busy ? "儲存中…" : "儲存並核准"}</AdminButton></>}
  >
    <form id={formId} className="adminTemporaryDutyForm" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p>營業日：<strong>{businessDate}</strong>（台灣時間）</p>
      {existing && <p className="adminWorkStatusHint">此日已有{existing.approvalStatus === "pending" ? "待核准" : existing.approvalStatus === "rejected" ? "已退回" : "休假或時段不完整的"}班表，將修改原紀錄並核准。</p>}
      {!staff.isActive && <p className="adminWorkStatusHint">此店員的公開卡片已隱藏；排班不會自動開放公開指名。</p>}
      <div className="adminTemporaryDutyTimes">
        <AdminField label="開始時間" required><input required disabled={busy || needsReselect} value={startTime} inputMode="numeric" maxLength={5} placeholder="例如 20:00" onChange={(event) => setStartTime(event.target.value)} /></AdminField>
        <AdminField label="結束時間" required><input required disabled={busy || needsReselect} value={endTime} inputMode="numeric" maxLength={5} placeholder="例如 02:00" onChange={(event) => setEndTime(event.target.value)} /></AdminField>
      </div>
      <p className="adminWorkStatusHint">結束時間早於開始時間代表翌日；凌晨補班可用 24:00～27:59 表示翌日 00:00～03:59，仍歸此營業日。請確認臨時到班的實際時段。</p>
      <fieldset className="adminWorkStatusRoles" disabled={busy || needsReselect}>
        <legend>排班職位</legend>
        <div className="adminWorkStatusOptions">{workRoleOptions.map((option) => <AdminToggle
          key={option.id}
          label={option.label}
          ariaLabel={`臨時排班${option.label}`}
          checked={roles.includes(option.id)}
          disabled={busy || needsReselect}
          onChange={(enabled: boolean) => setRoles((current) => enabled ? [...new Set([...current, option.id])] : current.filter((role) => role !== option.id))}
        />)}</div>
      </fieldset>
      {error && <p className="adminFormError" role="alert">{error}{needsReselect ? " 請關閉後重新選取確認。" : ""}</p>}
    </form>
  </AdminDialog>;
}
