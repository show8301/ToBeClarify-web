import type { OperationsOrder } from "./operationsTypes";
import type { WorkbenchUnit } from "./workbenchApi";

export type ServiceFilter = "unfinished" | "coordination" | "meal" | "room" | "manager";
const terminal = new Set(["cancelled", "expired", "rejected"]);

export function currentUnits(order: OperationsOrder, units: WorkbenchUnit[], periodId: string) {
  return units.filter((u) => (u.fulfillmentPeriodId || order.businessPeriodId) === periodId);
}

export function serviceTask(order: OperationsOrder, units: WorkbenchUnit[], periodId: string) {
  const active = currentUnits(order, units, periodId).filter((u) => u.kind !== "tip" && !["cancelled", "carried_forward"].includes(u.status)
    && u.completedQuantity + u.cancelledQuantity < u.quantity);
  const coordination = order.storeConfirmationStatus === "pending" && order.businessPeriodId === periodId;
  const manager = active.some((u) => u.status === "needs_coordination") || order.status === "needs_reschedule" && order.businessPeriodId === periodId;
  const legacy = (order.flowVersion || 1) < 2 && order.businessPeriodId === periodId && !["completed", ...terminal].includes(order.status);
  return {
    unfinished: !terminal.has(order.status) && (coordination || manager || legacy || active.length > 0),
    coordination, manager, meal: active.some((u) => u.kind === "meal"), room: active.some((u) => u.kind === "room"),
    remaining: active.length,
  };
}
