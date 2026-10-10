import type { OperationsNominee, OperationsOrder } from "./operationsTypes";
import type { WorkbenchUnit } from "./workbenchApi";
import type { ServiceAction, ServiceEntry } from "./WorkbenchServiceDialog";

export function legacyStandalone(order: OperationsOrder): boolean {
  return order.nominees.length === 1 && !order.roomBookings.length && !order.addons.length &&
    Boolean(order.items?.length) && Boolean(order.items?.every((item) => ["nomination_base", "staff_service", "tip"].includes(item.kind)));
}

export function resolveServiceStatus(order: OperationsOrder, nominee: OperationsNominee, unit: WorkbenchUnit | null): string {
  if (unit) return unit.status;
  if (["completed", "cancelled"].includes(order.status)) return order.status;
  if (order.status === "in_service" && legacyStandalone(order)) return "in_service";
  return nominee.confirmationStatus;
}

export function canAct(entry: ServiceEntry, action: ServiceAction, now: number): boolean {
  if (entry.order.storeConfirmationStatus === "pending") return false;
  if (entry.unit) return entry.unit.allowedActions.includes(action) && (action !== "start_now" || entry.unit.acceptedQuantity > 0);
  if ((entry.order.flowVersion || 1) >= 2) return false;
  if (action === "accept" || action === "decline") return entry.nominee.confirmationStatus === "waiting" && ["submitted", "partially_confirmed"].includes(entry.order.status);
  if (action === "shorten") return entry.nominee.segmentCount > (entry.nominee.minimumSegments || 1) && Date.parse(entry.nominee.requestedStartsAt) > now && ["waiting", "confirmed"].includes(entry.status);
  if (!legacyStandalone(entry.order)) return false;
  return action === "start_now" ? entry.order.status === "confirmed" : action === "complete" ? entry.order.status === "in_service" : action === "cancel" && ["submitted", "partially_confirmed", "confirmed"].includes(entry.order.status);
}
