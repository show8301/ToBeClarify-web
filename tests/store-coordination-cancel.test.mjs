import assert from "node:assert/strict";
import test from "node:test";
import { customerProgress } from "../features/admin/orders/customerProgress.ts";

test("cancelling a pending coordination order removes it from the attention group", () => {
  assert.deepEqual(customerProgress([
    { status: "cancelled", storeConfirmationStatus: "pending" },
  ], 1), { group: "inactive", label: "僅取消／失效訂單" });
});

test("cancelling one order keeps the customer's other pending work visible", () => {
  assert.deepEqual(customerProgress([
    { status: "cancelled", storeConfirmationStatus: "pending" },
    { status: "submitted", storeConfirmationStatus: "pending" },
  ], 2), { group: "attention", label: "1 張待確認／協調" });
});

test("a cancelled coordination order does not hide another active service", () => {
  assert.deepEqual(customerProgress([
    { status: "cancelled", storeConfirmationStatus: "pending" },
    { status: "in_service", storeConfirmationStatus: "approved" },
  ], 2), { group: "active", label: "1 張尚未完成" });
});
