import assert from "node:assert/strict";
import test from "node:test";
import { canAct, resolveServiceStatus } from "../features/admin/operations/workbenchRules.ts";

const now = Date.parse("2026-10-10T22:00:00+08:00");
const nominee = { id: "nominee-a", staffId: "staff-a", confirmationStatus: "waiting", segmentCount: 3, minimumSegments: 1, requestedStartsAt: "2026-10-10T22:30:00+08:00" };
const order = { id: "order-a", status: "in_service", storeConfirmationStatus: "approved", flowVersion: 2, nominees: [nominee], roomBookings: [], addons: [], items: [{ kind: "nomination_base" }] };
const unit = { id: "unit-a", status: "waiting", acceptedQuantity: 0, allowedActions: ["accept", "decline", "start_now"] };
const entry = { order, nominee, unit, status: "waiting" };

test("a meal being served does not turn a waiting nomination into an active service", () => {
  assert.equal(resolveServiceStatus(order, nominee, unit), "waiting");
  assert.equal(canAct(entry, "complete", now), false);
  assert.equal(canAct(entry, "accept", now), true);
});

test("a waiting request cannot bypass the staff confirmation by starting now", () => {
  assert.equal(canAct(entry, "start_now", now), false);
  assert.equal(canAct({ ...entry, unit: { ...unit, acceptedQuantity: 1 } }, "start_now", now), true);
});

test("store coordination must be accepted before the person can respond", () => {
  const pending = { ...entry, order: { ...order, storeConfirmationStatus: "pending" } };
  assert.equal(canAct(pending, "accept", now), false);
  assert.equal(canAct(pending, "decline", now), false);
});

test("a declined request stays with the manager until the server grants another action", () => {
  const declined = { ...entry, unit: { ...unit, status: "needs_coordination", allowedActions: [] } };
  for (const action of ["accept", "decline", "start_now", "cancel", "reschedule"]) assert.equal(canAct(declined, action, now), false);
  assert.equal(resolveServiceStatus(order, nominee, declined.unit), "needs_coordination");
});

test("unloaded v2 progress grants no actions and legacy mixed orders cannot mutate the whole order", () => {
  assert.equal(canAct({ ...entry, unit: null }, "accept", now), false);
  const mixed = { ...entry, unit: null, status: "confirmed", order: { ...order, flowVersion: 1, status: "confirmed", items: [{ kind: "nomination_base" }, { kind: "meal" }] } };
  assert.equal(canAct(mixed, "start_now", now), false);
  assert.equal(canAct(mixed, "cancel", now), false);
  assert.equal(resolveServiceStatus({ ...mixed.order, status: "in_service" }, nominee, null), "waiting");
});

test("shortening respects the minimum purchased segments and the service start time", () => {
  const legacy = { ...entry, unit: null, status: "confirmed", order: { ...order, flowVersion: 1, status: "confirmed" } };
  assert.equal(canAct(legacy, "shorten", now), true);
  assert.equal(canAct({ ...legacy, nominee: { ...nominee, segmentCount: 1 } }, "shorten", now), false);
  assert.equal(canAct(legacy, "shorten", Date.parse(nominee.requestedStartsAt)), false);
});
