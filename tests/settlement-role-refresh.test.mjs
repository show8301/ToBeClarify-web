import assert from "node:assert/strict";
import test from "node:test";
import { mergeRefreshedInputs } from "../features/admin/settlement/refresh-inputs.ts";

const input = (role, version, extra = {}) => ({ staffId: "staff", role, payrollSnapshotVersion: version,
  actualMinutes: 90, activityHours: 2, attendanceSource: "backfill_approved", attendanceRequestId: "approved",
  isBackstageParticipant: role === "backstage", publicTipEligible: role !== "backstage", note: "reviewed", ...extra });

test("refresh migrates a locally edited primary role without retaining the old wage row", () => {
  const before = input("service", 1);
  const next = input("designated", 2);
  const rows = mergeRefreshedInputs([{ ...before, actualMinutes: 120, note: "local" }], [before], [next]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "designated");
  assert.equal(rows[0].payrollSnapshotVersion, 2);
  assert.equal(rows[0].actualMinutes, 120);
  assert.equal(rows[0].note, "local");
  assert.equal(rows[0].attendanceRequestId, "approved");
});

test("a correction to backstage merges secondary participation and preserves the edited primary hours", () => {
  const before = [input("service", 1), input("backstage", 1, { actualMinutes: 0 })];
  const rows = mergeRefreshedInputs([{ ...before[0], actualMinutes: 120 }, before[1]], before, [input("backstage", 2)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actualMinutes, 120);
  assert.equal(rows[0].isBackstageParticipant, true);
  assert.equal(rows[0].publicTipEligible, false);
});

test("a correction from backstage preserves local primary activity allocation", () => {
  const before = input("backstage", 1);
  const rows = mergeRefreshedInputs([{ ...before, activityHours: 3 }], [before], [input("service", 2)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].activityHours, 3);
  assert.equal(rows[0].role, "service");
  assert.equal(rows[0].isBackstageParticipant, false);
});

test("unrelated manual inputs and same-version local edits survive a refresh", () => {
  const before = input("service", 1);
  const manual = { ...input("designated", 1), staffId: "other" };
  const rows = mergeRefreshedInputs([{ ...before, actualMinutes: 120 }, manual], [before], [before]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].actualMinutes, 120);
  assert.equal(rows[1].staffId, "other");
});
