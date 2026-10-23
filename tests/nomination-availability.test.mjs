import assert from "node:assert/strict";
import test from "node:test";
import { availableStarts, nominationStatus, parseNominationAvailability } from "../features/ordering/nomination-availability.ts";

const start = "2026-10-23T20:00:00+08:00";
const end = "2026-10-24T02:00:00+08:00";
const now = Date.parse(start);
const person = {
  staffId: "sample", isAccepting: true, shiftStartsAt: start, shiftEndsAt: end,
  bufferMinutes: 10, isServing: false, isOverdue: false, windows: [{ startsAt: start, endsAt: end }],
};

test("service and rest must fit the same free window", () => {
  const windows = [{ startsAt: start, endsAt: "2026-10-23T20:30:00+08:00" }];
  assert.deepEqual(availableStarts({ ...person, windows }, 20, now), []);
  const starts = availableStarts({ ...person, bufferMinutes: 0, windows }, 20, now);
  assert.equal(starts.at(-1), new Date(now + 10 * 60_000).toISOString());
});

test("fully booked until close is not described as future availability", () => {
  assert.equal(nominationStatus({ ...person, windows: [] }, 20, now, end), "今日預約已滿");
  const before = now - 30 * 60_000;
  assert.equal(nominationStatus(person, 20, before, end), "尚未到班，可預約稍後時段");
  assert.equal(nominationStatus({ ...person, isOverdue: true }, 20, now, end), "服務尚未結束，暫停預約");
});

test("coordination after close remains possible within the shift", () => {
  const close = "2026-10-23T22:00:00+08:00";
  const late = { ...person, windows: [{ startsAt: close, endsAt: end }] };
  assert.equal(nominationStatus(late, 20, now, close), "今日預約已滿");
  assert.ok(availableStarts(late, 20, now).length > 0);
});

test("invalid or missing contracts fail closed", () => {
  assert.throws(() => parseNominationAvailability({}));
  const payload = { businessDate: "2026-10-23", checkedAt: start, projectedCloseAt: end, nominationPaused: false, staff: [person] };
  assert.equal(parseNominationAvailability(payload).staff.length, 1);
  assert.throws(() => parseNominationAvailability({ ...payload, staff: [{ ...person, bufferMinutes: -1 }] }));
  assert.throws(() => parseNominationAvailability({ ...payload, checkedAt: "2026-10-23T20:00:00" }));
  assert.deepEqual(availableStarts(undefined, 20, now), []);
  assert.deepEqual(availableStarts({ ...person, isAccepting: false }, 20, now), []);
});
