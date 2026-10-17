import assert from "node:assert/strict";
import test from "node:test";
import { completionOption, orderFinance, orderProgress } from "../features/admin/operations/workbenchOrderProgress.ts";

const unit = { kind: "meal", quantity: 3, acceptedQuantity: 0, startedQuantity: 0, completedQuantity: 0, cancelledQuantity: 0, status: "waiting", allowedActions: ["backfill"] };
const order = { id: "order-a", sessionId: "guest-a", totalAmount: 800_000, status: "confirmed" };
const record = { orderId: "order-a", sourceKind: "order", allocationStatus: "confirmed", holdScope: "none", cashPeriodId: "period-a" };
const account = { sessionId: "guest-a", canWrite: true, records: [] };

test("a completed nomination leaves the meal and room unfinished", () => {
  const tasks = [
    { ...unit, kind: "nominee", quantity: 1, completedQuantity: 1, status: "completed" },
    { ...unit, quantity: 1 }, { ...unit, kind: "room", quantity: 1 },
  ];
  assert.deepEqual(orderProgress(tasks), { total: 3, completed: 1, label: "1／3 項完成" });
  assert.equal(orderProgress(tasks.map((item) => ({ ...item, completedQuantity: 1 }))).label, "全部完成");
});

test("fees and cancelled quantities do not create additional unfinished tasks", () => {
  const tasks = [
    { ...unit, completedQuantity: 2, cancelledQuantity: 1 },
    { ...unit, kind: "tip" }, { ...unit, kind: "room", cancelledQuantity: 3 },
  ];
  assert.equal(orderProgress(tasks).label, "全部完成");
  assert.equal(orderProgress([]).label, "進度尚未確認");
});

test("finish started quantities before backfilling the rest of a meal", () => {
  const partial = { ...unit, startedQuantity: 1, allowedActions: ["complete", "backfill"] };
  assert.deepEqual(completionOption(partial), { action: "complete", quantity: 1 });
  assert.deepEqual(completionOption({ ...partial, completedQuantity: 1 }), { action: "backfill", quantity: 2 });
  assert.equal(completionOption({ ...partial, allowedActions: ["backfill"] }), null);
  assert.equal(completionOption({ ...unit, kind: "nominee" }), null);
  assert.equal(completionOption({ ...unit, allowedActions: [] }), null);
});

test("order receipts include adjustments and refunds without charging admission or meal credit twice", () => {
  const records = [
    { ...record, kind: "charge_add", amount: 5_000 },
    { ...record, kind: "charge_reduce", sourceKind: "item", amount: 2_000 },
    { ...record, kind: "cash_receipt", amount: 500_000 },
    { ...record, kind: "cash_refund", amount: 10_000 },
    { ...record, kind: "cash_receipt", sourceKind: "admission", orderId: null, amount: 50_000 },
    { ...record, kind: "cash_receipt", orderId: "order-b", amount: 200_000 },
  ];
  const summary = orderFinance(order, { ...account, records });
  assert.equal(summary.receivable, 803_000);
  assert.equal(summary.netCash, 490_000);
  assert.equal(summary.balance, 313_000);
  assert.equal(summary.label, "部分收款");
  assert.equal(summary.blockedReason, "");
});

test("unallocated or pending receipts block another order collection", () => {
  for (const pending of [
    { ...record, sourceKind: "unallocated", orderId: null },
    { ...record, allocationStatus: "pending" },
    { ...record, cashPeriodId: null },
    { ...record, orderId: "order-b", holdScope: "session" },
  ]) {
    const summary = orderFinance(order, { ...account, records: [{ ...pending, kind: "cash_receipt", amount: 10 }] });
    assert.equal(summary.label, "待核對帳款");
    assert.ok(summary.blockedReason);
  }
});

test("fully collected and overpaid orders show distinct payment states", () => {
  const paid = { ...account, records: [{ ...record, kind: "cash_receipt", amount: order.totalAmount }] };
  assert.equal(orderFinance(order, paid).label, "已收清");
  const refunded = orderFinance({ ...order, status: "cancelled" }, paid);
  assert.equal(refunded.label, "待退款");
  assert.equal(refunded.balance, -800_000);
  assert.ok(refunded.blockedReason);
  assert.ok(orderFinance(order, { ...account, sessionId: "another-guest" }).blockedReason);
});
