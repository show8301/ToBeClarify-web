import assert from "node:assert/strict";
import test from "node:test";
import { parseAdmissionPolicy, parseAdmissionPreview, parseAdmissionCreationResult, parseAdmissionCreated } from "../features/admin/orders/admission-creation-contract.ts";

const policy = { admissionAmount: 100_000, version: 1, mealCreditAmount: 60_000,
  amountSource: "ordering_admission_policy", creditSource: "ordering_settings.minimum_meal_credit" };
const preview = { contractVersion: 1, businessPeriodId: "period-a", businessDate: "2026-10-17",
  periodVersion: 1, policyVersion: 1, admissionAmount: 100_000, mealCreditAmount: 60_000,
  expiresAt: "2026-10-17T12:05:00+08:00", pricingRevision: "a".repeat(64),
  confirmedCreationAvailable: false, legacyCreationAllowed: true };
const result = { operationId: "operation-a", sessionId: "session-a", admissionId: "admission-a",
  businessPeriodId: "period-a", businessDate: "2026-10-17", admissionAmount: 100_000,
  discountAmount: 0, mealCreditAmount: 60_000, admissionStatus: "received", receivedAmount: 100_000,
  chargeRecordId: "charge-a", receiptRecordId: "receipt-a", cashPeriodId: "period-a", accountVersion: 2,
  recordedAt: "2026-10-17T12:00:00+08:00", recordedBy: "clerk-a", credentialAction: "explicit_reissue_if_needed" };

test("fee remains independent of meal credit; missing configuration is not zero", () => {
  assert.deepEqual(parseAdmissionPolicy(policy), policy);
  assert.equal(parseAdmissionPolicy({ ...policy, admissionAmount: null }).admissionAmount, null);
  assert.equal(parseAdmissionPolicy({ ...policy, admissionAmount: 0 }).admissionAmount, 0);
  assert.throws(() => parseAdmissionPolicy({ ...policy, admissionAmount: undefined }));
  assert.throws(() => parseAdmissionPolicy({ ...policy, amountSource: "price_text" }));
});

test("preview rejects unknown contracts, missing capabilities, unsafe money and invalid dates", () => {
  assert.deepEqual(parseAdmissionPreview(preview), preview);
  for (const update of [{ contractVersion: 2 }, { confirmedCreationAvailable: undefined },
    { admissionAmount: Number.MAX_SAFE_INTEGER + 1 }, { mealCreditAmount: -1 },
    { expiresAt: "2026-10-17T12:05:00" }, { businessDate: "2026-02-30" }, { pricingRevision: "invalid" }]) {
    assert.throws(() => parseAdmissionPreview({ ...preview, ...update }));
  }
});

test("received fee must match net amount and have a receipt and cash period", () => {
  assert.deepEqual(parseAdmissionCreationResult(result), result);
  assert.equal(parseAdmissionCreationResult({ ...result, discountAmount: 20_000, receivedAmount: 80_000 }).receivedAmount, 80_000);
  for (const update of [{ receivedAmount: 60_000 }, { receiptRecordId: null }, { cashPeriodId: null },
    { discountAmount: 110_000 }, { admissionStatus: "unpaid" }, { admissionStatus: "unknown" }]) {
    assert.throws(() => parseAdmissionCreationResult({ ...result, ...update }));
  }
});

test("waived or unpaid results cannot become receipts; lookup drops credentials", () => {
  const unpaid = { ...result, admissionStatus: "unpaid", receivedAmount: 0, receiptRecordId: null, cashPeriodId: null };
  assert.equal(parseAdmissionCreationResult(unpaid).receivedAmount, 0);
  assert.equal(parseAdmissionCreationResult({ ...unpaid, admissionStatus: "waived", discountAmount: 100_000 }).receivedAmount, 0);
  assert.throws(() => parseAdmissionCreationResult({ ...unpaid, admissionStatus: "waived" }));
  const parsed = parseAdmissionCreationResult({ ...result, orderToken: "must-not-propagate", recoveryCode: "must-not-propagate" });
  assert.equal("orderToken" in parsed, false);
  assert.equal("recoveryCode" in parsed, false);
});

test("committed retries return the same receipt without new ordering credentials", () => {
  assert.deepEqual(parseAdmissionCreated({ issued: null, result }), { issued: null, result });
  const issued = { session: { id: "session-a", gameId: "ID@server", customerName: "guest" }, orderUrl: "/order?code=example", orderToken: "example", recoveryCode: "123456" };
  assert.equal(parseAdmissionCreated({ issued, result }).issued.admission.receivedAmount, 100_000);
  assert.throws(() => parseAdmissionCreated({ issued: { ...issued, session: { ...issued.session, id: "other-session" } }, result }));
});
