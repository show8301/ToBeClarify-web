import assert from "node:assert/strict";
import test from "node:test";
import {
  createFulfillmentTransition,
  fulfillmentActionNeedsReason,
  getFulfillmentQuantityLimit,
} from "../features/admin/orders/fulfillment-operation.ts";

const unit = {
  kind: "meal", version: 7, quantity: 5, acceptedQuantity: 3,
  startedQuantity: 2, completedQuantity: 1, cancelledQuantity: 1,
};
const draft = {
  quantity: 1, reason: "  現場處理原因  ",
  startsAt: "2026-10-19T18:30", targetBusinessPeriodId: "next-period",
  actualStartsAt: "2026-10-18T18:00", actualEndsAt: "2026-10-18T18:20",
  restMinutes: 0, compensationAmount: 1000, compensationReason: "現場折讓",
};

test("each action uses its own available quantity rather than the purchased total", () => {
  assert.equal(getFulfillmentQuantityLimit(unit, "accept"), 1);
  assert.equal(getFulfillmentQuantityLimit(unit, "start"), 1);
  assert.equal(getFulfillmentQuantityLimit(unit, "complete"), 1);
  assert.equal(getFulfillmentQuantityLimit(unit, "cancel"), 2);
  assert.equal(getFulfillmentQuantityLimit(unit, "backfill"), 3);
});

test("ordinary acceptance does not submit hidden scheduling, backfill or discount drafts", () => {
  assert.deepEqual(createFulfillmentTransition(unit, "accept", draft, "same-operation"), {
    operationId: "same-operation", expectedVersion: 7, action: "accept", quantity: 1,
    reason: null, scheduledStartsAt: null, targetBusinessPeriodId: null,
    restMinutes: -1, compensationAmount: 0, compensationReason: null,
    actualStartsAt: null, actualEndsAt: null,
  });
  assert.equal(draft.compensationAmount, 1000);
  assert.equal(draft.targetBusinessPeriodId, "next-period");
});

test("meal and room transfers send all unserved quantities, including when a smaller draft was entered", () => {
  for (const kind of ["meal", "room"]) {
    const request = createFulfillmentTransition({ ...unit, kind, startedQuantity: 0 }, "carry_forward", draft, "transfer");
    assert.equal(request.quantity, 4);
    assert.equal(request.targetBusinessPeriodId, "next-period");
    assert.equal(request.scheduledStartsAt, null);
    assert.equal(request.reason, "現場處理原因");
    assert.equal(request.compensationAmount, 0);
  }
});

test("an unassigned nominee transfer remains a reservation and does not send a stale new start time", () => {
  const request = createFulfillmentTransition(
    { ...unit, kind: "nominee" }, "carry_forward", { ...draft, targetBusinessPeriodId: "" }, "reserve",
  );
  assert.equal(request.quantity, 1);
  assert.equal(request.targetBusinessPeriodId, null);
  assert.equal(request.scheduledStartsAt, null);
});

test("rescheduling uses Taiwan time and excludes actual service and discount drafts", () => {
  const request = createFulfillmentTransition({ ...unit, kind: "nominee" }, "reschedule", draft, "reschedule");
  assert.equal(request.scheduledStartsAt, "2026-10-19T18:30:00+08:00");
  assert.equal(request.actualStartsAt, null);
  assert.equal(request.actualEndsAt, null);
  assert.equal(request.compensationAmount, 0);
});

test("backfill and start-now only submit the fields for their selected operation", () => {
  const backfill = createFulfillmentTransition(unit, "backfill", draft, "backfill");
  assert.equal(backfill.actualStartsAt, "2026-10-18T18:00:00+08:00");
  assert.equal(backfill.actualEndsAt, "2026-10-18T18:20:00+08:00");
  assert.equal(backfill.targetBusinessPeriodId, null);
  assert.equal(backfill.compensationAmount, 0);
  const start = createFulfillmentTransition({ ...unit, kind: "nominee" }, "start_now", draft, "start");
  assert.equal(start.compensationAmount, 1000);
  assert.equal(start.compensationReason, "現場折讓");
  assert.equal(start.restMinutes, 0);
  assert.equal(start.actualStartsAt, null);
});

test("the existing mandatory-reason actions include backfill", () => {
  for (const action of ["cancel", "decline", "reschedule", "carry_forward", "backfill"]) {
    assert.equal(fulfillmentActionNeedsReason(action), true);
  }
  assert.equal(fulfillmentActionNeedsReason("accept"), false);
});
