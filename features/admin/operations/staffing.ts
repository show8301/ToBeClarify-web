import { isRecord, formatDateTime } from "./operationsFormat";
import type { OperationsDutyPlan, OperationsOrder, OperationsStaffMember, WorkRole } from "./operationsTypes";
import { isPayrollRole } from "@/features/admin/shared/workRoles";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function parseDutyPlan(value: unknown): OperationsDutyPlan | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id
    || typeof value.staffId !== "string" || !value.staffId
    || typeof value.staffName !== "string"
    || typeof value.businessDate !== "string" || !datePattern.test(value.businessDate)
    || typeof value.isWorking !== "boolean"
    || (value.approvalStatus !== "approved" && value.approvalStatus !== "pending" && value.approvalStatus !== "rejected")
    || !Array.isArray(value.scheduledRoles)
    || !value.scheduledRoles.every((role): role is WorkRole => role === "service" || role === "designated" || role === "backstage")
    || (value.payrollRole != null && !isPayrollRole(value.payrollRole))) return null;
  const startsAt = nullableString(value.startsAt);
  const endsAt = nullableString(value.endsAt);
  if ((startsAt && !Number.isFinite(Date.parse(startsAt))) || (endsAt && !Number.isFinite(Date.parse(endsAt)))) return null;
  return {
    id: value.id,
    staffId: value.staffId,
    staffName: value.staffName,
    businessDate: value.businessDate,
    isWorking: value.isWorking,
    approvalStatus: value.approvalStatus,
    scheduledRoles: [...value.scheduledRoles],
    payrollRole: isPayrollRole(value.payrollRole) ? value.payrollRole : null,
    startTime: nullableString(value.startTime),
    endTime: nullableString(value.endTime),
    startsAt,
    endsAt,
    submittedAt: nullableString(value.submittedAt) || "",
    approvedAt: nullableString(value.approvedAt) || "",
  };
}

export function parseDutyPlans(value: unknown): OperationsDutyPlan[] {
  if (!Array.isArray(value)) throw new Error("班表資料格式異常，請重新整理。");
  const plans = value.map(parseDutyPlan);
  if (plans.some((plan) => plan === null)) throw new Error("班表資料不完整，請重新整理。");
  const valid = plans.filter((plan): plan is OperationsDutyPlan => plan !== null);
  if (new Set(valid.map((plan) => `${plan.staffId}:${plan.businessDate}`)).size !== valid.length) {
    throw new Error("同一店員的營業日班表重複，請至值班規劃確認。");
  }
  return valid;
}

export function isApprovedShift(plan: OperationsDutyPlan): boolean {
  return plan.approvalStatus === "approved" && plan.isWorking
    && Boolean(plan.startsAt && plan.endsAt && Date.parse(plan.endsAt) > Date.parse(plan.startsAt));
}

export function dutyPlanRevision(plan: OperationsDutyPlan | null): string {
  return plan ? JSON.stringify([plan.id, plan.approvalStatus, plan.isWorking, plan.startTime, plan.endTime,
    [...plan.scheduledRoles].sort(), plan.payrollRole, plan.submittedAt, plan.approvedAt]) : "";
}

export function shiftText(plan: OperationsDutyPlan): string {
  return plan.startsAt && plan.endsAt ? `${formatDateTime(plan.startsAt)} ～ ${formatDateTime(plan.endsAt)}` : "班次時段尚未完整";
}

export function shiftStatus(plan: OperationsDutyPlan, staff: OperationsStaffMember | undefined, now: number): string {
  if (staff?.isWorkingToday && staff.todayWorkMode?.businessDate === plan.businessDate) return "執勤中";
  if (!plan.startsAt || !plan.endsAt) return "時段待確認";
  if (now < Date.parse(plan.startsAt)) return "尚未到班";
  if (now >= Date.parse(plan.endsAt)) return "班次已結束";
  return "執勤狀態待確認";
}

export function rosterPlans(plans: OperationsDutyPlan[], staff: OperationsStaffMember[], businessDate: string, now: number): OperationsDutyPlan[] {
  const byStaff = new Map(staff.map((person) => [person.id, person]));
  const rank = (plan: OperationsDutyPlan) => {
    const status = shiftStatus(plan, byStaff.get(plan.staffId), now);
    return status === "執勤中" ? 0 : status === "執勤狀態待確認" ? 1 : status === "尚未到班" ? 2 : 3;
  };
  return plans.filter((plan) => isApprovedShift(plan) && (plan.businessDate === businessDate
    || (byStaff.get(plan.staffId)?.isWorkingToday && byStaff.get(plan.staffId)?.todayWorkMode?.businessDate === plan.businessDate)))
    .sort((left, right) => rank(left) - rank(right) || (left.startsAt || "").localeCompare(right.startsAt || "")
      || left.staffName.localeCompare(right.staffName, "zh-TW"));
}

export function staffingServiceAlerts(orders: OperationsOrder[], staff: OperationsStaffMember[], now: number) {
  const staffById = new Map(staff.map((person) => [person.id, person]));
  const alerts = new Map<string, { id: string; title: string; detail: string; action: string }>();
  for (const order of orders) {
    if (order.status !== "in_service" && !order.nominees.some((nominee) => nominee.confirmationStatus === "in_service")) continue;
    for (const nominee of order.nominees) {
      const active = nominee.confirmationStatus === "in_service" || (nominee.confirmationStatus === "confirmed"
        && Date.parse(nominee.requestedStartsAt) <= now && Date.parse(nominee.requestedServiceEndsAt) > now);
      if (!active || staffById.get(nominee.staffId)?.isWorkingToday) continue;
      alerts.set(nominee.staffId, {
        id: `staff-service-${nominee.staffId}`,
        title: `${nominee.staffName} 有進行中訂單，但目前未執勤`,
        detail: "請確認班表與服務交接，避免漏掉尚未完成的工作。",
        action: "確認值班規劃",
      });
    }
  }
  return [...alerts.values()];
}

export function intakeText(staff: OperationsStaffMember | undefined): string {
  return !staff?.todayWorkMode ? "接單狀態待確認" : staff.todayWorkMode.stopAcceptingNewOrders ? "新指名已暫停" : "新指名未暫停";
}
