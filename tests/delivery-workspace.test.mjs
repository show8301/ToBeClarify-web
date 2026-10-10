import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleFromSource(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const presentation = await moduleFromSource("../features/admin/deliveries/presentation.ts");
const validation = await moduleFromSource("../features/admin/customers/validation.ts");
const legacy = {
  id: "work-1", sessionId: "session-1", customerUid: null, gameId: "guest", customerName: "Guest", businessDate: "2026-10-01",
  orderId: null, orderNumber: null, orderItemId: null, title: "Commission", description: null, status: "pending", dueDate: "2026-10-08",
  version: 1, createdAt: "2026-10-01T12:00:00", updatedAt: "2026-10-01T12:00:00", deliveredAt: null, assets: [],
};
test("legacy responses stay unassigned without claiming credential disclosure is available", () => {
  const delivery = validation.parseDelivery(legacy);
  assert.equal(delivery.workspaceAvailable, false);
  assert.equal(delivery.assignedStaffId, null);
  assert.equal(delivery.canViewClaimCode, false);
});
test("workspace fields reject malformed metadata rather than silently enabling controls", () => {
  assert.throws(() => validation.parseDelivery({ ...legacy, workspaceAvailable: "true" }));
  assert.throws(() => validation.parseDelivery({ ...legacy, assignedStaffId: 12 }));
  assert.throws(() => validation.parseDelivery({ ...legacy, notifiedAt: false }));
  assert.throws(() => validation.parseDelivery({ ...legacy, canViewClaimCode: 1 }));
});
test("ready, delivered and cancelled works never become overdue", () => {
  for (const status of ["ready", "delivered", "cancelled"]) assert.equal(presentation.isOverdue({ ...legacy, status }, "2026-10-10"), false);
  for (const status of ["pending", "in_progress"]) assert.equal(presentation.isOverdue({ ...legacy, status }, "2026-10-10"), true);
  assert.equal(presentation.isOverdue({ ...legacy, dueDate: "2026-10-10" }, "2026-10-10"), false);
  assert.equal(presentation.isOverdue({ ...legacy, dueDate: null }, "2026-10-10"), false);
});
test("opening collection access does not imply notification or acknowledgement", () => {
  assert.equal(presentation.nextAction({ ...legacy, status: "ready", notifiedAt: null }), "傳送領取資料並記錄通知");
  assert.equal(presentation.nextAction({ ...legacy, status: "ready", notifiedAt: "2026-10-10" }), "已通知，等待顧客確認收到");
  assert.equal(presentation.nextAction({ ...legacy, status: "delivered", notifiedAt: null }), "已領取，查看處理紀錄");
});
test("due dates follow Taiwan's calendar across the UTC day boundary", () => {
  assert.equal(presentation.taipeiToday(new Date("2026-10-09T16:01:00Z")), "2026-10-10");
  assert.equal(presentation.taipeiToday(new Date("2026-10-09T15:59:00Z")), "2026-10-09");
});
