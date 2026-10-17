import type { FinanceAccount } from "../orders/finance-types";
import type { OperationsOrder } from "./operationsTypes";
import type { WorkbenchUnit } from "./workbenchApi";

export function orderProgress(units: WorkbenchUnit[]) {
  const tasks = units.filter((unit) => unit.kind !== "tip");
  const active = tasks.filter((unit) => unit.cancelledQuantity < unit.quantity);
  const completed = active.filter((unit) => unit.completedQuantity === unit.quantity - unit.cancelledQuantity).length;
  return {
    total: active.length,
    completed,
    label: !tasks.length ? "進度尚未確認" : !active.length ? "項目已取消"
      : completed === active.length ? "全部完成" : `${completed}／${active.length} 項完成`,
  };
}

export function completionOption(unit: WorkbenchUnit) {
  if (!["meal", "room"].includes(unit.kind)) return null;
  const started = unit.startedQuantity - unit.completedQuantity;
  if (started > 0 && unit.allowedActions.includes("complete")) {
    return { action: "complete" as const, quantity: started };
  }
  const remaining = unit.quantity - unit.cancelledQuantity - unit.completedQuantity;
  // Backfill increments started and completed together. Finish any started
  // quantity first so a partially delivered item cannot be counted twice.
  if (started === 0 && remaining > 0 && unit.allowedActions.includes("backfill")) {
    return { action: "backfill" as const, quantity: remaining };
  }
  return null;
}

export function orderFinance(order: OperationsOrder, account: FinanceAccount) {
  const records = account.records.filter((record) => record.orderId === order.id && ["order", "item"].includes(record.sourceKind));
  const sum = (kind: string) => records.filter((record) => record.kind === kind).reduce((total, record) => total + record.amount, 0);
  const additions = sum("charge_add");
  const reductions = sum("charge_reduce");
  const received = sum("cash_receipt");
  const refunded = sum("cash_refund");
  const receivable = (["cancelled", "expired", "rejected"].includes(order.status) ? 0 : order.totalAmount) + additions - reductions;
  const netCash = received - refunded;
  const balance = receivable - netCash;
  const uncertain = account.records.some((record) => record.amount > 0 && (
    record.sourceKind === "unallocated" || record.holdScope === "session" ||
    record.orderId === order.id && (record.allocationStatus === "pending" ||
      ["cash_receipt", "cash_refund"].includes(record.kind) && !record.cashPeriodId)
  ));
  const blockedReason = account.sessionId !== order.sessionId ? "帳款所屬顧客不符，請重新整理。"
    : uncertain ? "有未確認或未歸屬的帳款，請先至完整點單管理核對。"
      : !account.canWrite ? "此帳款目前無法新增收款，請至完整點單管理核對。"
        : ["cancelled", "expired", "rejected"].includes(order.status) ? "此訂單已取消或失效。" : "";
  return {
    additions, reductions, received, refunded, receivable, netCash, balance, blockedReason,
    label: uncertain || account.sessionId !== order.sessionId ? "待核對帳款" : balance < 0 ? "待退款"
      : balance === 0 ? receivable > 0 || netCash > 0 ? "已收清" : "無須收款"
        : netCash > 0 ? "部分收款" : "尚未收款",
  };
}

export function unitProgressLabel(unit: WorkbenchUnit) {
  if (unit.status === "cancelled") return "已取消";
  if (unit.status === "carried_forward") return "保留待安排";
  if (unit.status === "needs_coordination") return "待經理協調";
  if (unit.status === "completed") return unit.kind === "meal" ? "已送達" : "已完成";
  if (unit.startedQuantity > unit.completedQuantity) return unit.kind === "room" ? "使用中" : "處理中";
  if (unit.acceptedQuantity > unit.completedQuantity) return "已接手";
  return "待處理";
}
