import assert from "node:assert/strict";
import test from "node:test";
import { serviceTask } from "../features/admin/operations/serviceQueue.ts";

const order = { status: "confirmed", flowVersion: 2, businessPeriodId: "today", storeConfirmationStatus: "not_required" };
const unit = { kind: "meal", status: "waiting", quantity: 3, completedQuantity: 0, cancelledQuantity: 0, fulfillmentPeriodId: "" };

test("confirmed orders remain actionable until every meal is delivered", () => {
  assert.equal(serviceTask(order, [unit], "today").meal, true);
  assert.equal(serviceTask(order, [{ ...unit, completedQuantity: 2 }], "today").unfinished, true);
  assert.equal(serviceTask(order, [{ ...unit, completedQuantity: 2, cancelledQuantity: 1 }], "today").unfinished, false);
});
test("mixed orders preserve remaining room work after a nomination finishes", () => {
  const items = [{ ...unit, kind: "nominee", quantity: 1, completedQuantity: 1, status: "completed" }, { ...unit, kind: "room", quantity: 1 }];
  const task = serviceTask(order, items, "today");
  assert.equal(task.room, true);
  assert.equal(task.remaining, 1);
});
test("carry-forward tasks follow the fulfillment period, not original admission date", () => {
  const old = { ...order, businessPeriodId: "yesterday" };
  assert.equal(serviceTask(old, [unit], "today").unfinished, false);
  assert.equal(serviceTask(old, [{ ...unit, fulfillmentPeriodId: "today" }], "today").unfinished, true);
  assert.equal(serviceTask(order, [{ ...unit, fulfillmentPeriodId: "tomorrow" }], "today").unfinished, false);
});
test("coordination is one order task, while terminal and tip-only orders are excluded", () => {
  const task = serviceTask({ ...order, storeConfirmationStatus: "pending" }, [unit], "today");
  assert.equal(task.coordination, true);
  assert.equal(task.unfinished, true);
  assert.equal(serviceTask({ ...order, status: "cancelled" }, [unit], "today").unfinished, false);
  assert.equal(serviceTask(order, [{ ...unit, kind: "tip" }], "today").unfinished, false);
  assert.equal(serviceTask(order, [{ ...unit, status: "needs_coordination" }], "today").manager, true);
});
