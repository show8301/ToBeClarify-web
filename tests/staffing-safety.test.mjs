import test from "node:test";
import assert from "node:assert/strict";
import { initialDutyWorking, shiftRange, reducesAvailability, affectedCommitments, parseStaffCommitments } from "../features/admin/operations/staffingSafety.ts";

const plan = {
  isWorking: true, approvalStatus: "approved",
  startsAt: "2026-10-16T20:00:00+08:00", endsAt: "2026-10-17T02:00:00+08:00",
};
const reservation = (overrides = {}) => ({
  id: "reservation-1", staffId: "staff-1", status: "active", serviceLabel: "指名服務",
  startsAt: "2026-10-16T23:00:00+08:00", endsAt: "2026-10-17T01:00:00+08:00", ...overrides,
});
const payload = (reservations) => ({ syncedAt: "2026-10-16T12:00:00Z", reservations });

test("adding a previously off-duty staff member defaults to working; editing preserves leave", () => {
  const leave = { ...plan, isWorking: false };
  assert.equal(initialDutyWorking("add", leave), true);
  assert.equal(initialDutyWorking("edit", leave), false);
  assert.equal(initialDutyWorking("add", null), true);
});

test("cross-midnight and extended-hour inputs refer to the same Taiwan interval", () => {
  const ordinary = shiftRange("2026-10-16", "20:00", "02:00");
  assert.deepEqual(ordinary, { startsAt: Date.parse(plan.startsAt), endsAt: Date.parse(plan.endsAt) });
  assert.equal(shiftRange("2026-10-16", "24:00", "26:00").endsAt, ordinary.endsAt);
  assert.equal(shiftRange("2026-10-16", "20:00", "20:00"), null);
  assert.equal(shiftRange("2026-10-16", "24:00", "00:00"), null);
  assert.equal(shiftRange("2026-10-16", "28:00", "02:00"), null);
});

test("extensions remain available while leave, later starts and earlier ends need service checks", () => {
  assert.equal(reducesAvailability(plan, true, shiftRange("2026-10-16", "19:00", "03:00")), false);
  assert.equal(reducesAvailability(plan, true, shiftRange("2026-10-16", "21:00", "02:00")), true);
  assert.equal(reducesAvailability(plan, true, shiftRange("2026-10-16", "20:00", "01:00")), true);
  assert.equal(reducesAvailability(plan, false, null), true);
  assert.equal(reducesAvailability({ ...plan, startsAt: null }, true, shiftRange("2026-10-16", "20:00", "02:00")), true);
});

test("unknown or incomplete service data is rejected instead of becoming an empty queue", () => {
  assert.throws(() => parseStaffCommitments({}, "staff-1"));
  assert.throws(() => parseStaffCommitments(payload([reservation({ endsAt: "invalid" })]), "staff-1"));
  assert.throws(() => parseStaffCommitments(payload([reservation({ status: undefined })]), "staff-1"));
  assert.equal(parseStaffCommitments(payload([reservation({ status: "future_unknown_status" })]), "staff-1").length, 1);
});

test("only nonterminal commitments for the selected staff affect a shift", () => {
  const items = parseStaffCommitments(payload([
    reservation(), reservation({ id: "completed", status: "completed" }),
    reservation({ id: "cancelled", status: "cancelled" }), reservation({ id: "other", staffId: "staff-2" }),
  ]), "staff-1");
  assert.equal(items.length, 1);
  assert.equal(affectedCommitments(items, true, shiftRange("2026-10-16", "23:00", "01:00")).length, 0);
  assert.equal(affectedCommitments(items, true, shiftRange("2026-10-16", "23:00", "00:30")).length, 1);
  assert.equal(affectedCommitments(items, false, null).length, 1);
});
