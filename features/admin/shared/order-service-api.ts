import { adminRequest } from "@/features/admin/api/client.js";
import type { OrderServiceAction, OrderServiceCommand, OrderServiceEligibility } from "./order-service-types";

const path = (id: string) => `/orders/${encodeURIComponent(id)}/fulfillment`;
const invalid = () => new Error("整單服務資料格式不正確，請重新整理。");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return Object.fromEntries(Object.entries(value));
}
function string(value: unknown): string {
  if (typeof value !== "string") throw invalid();
  return value;
}
function nullableString(value: unknown): string | null { return value === null ? null : string(value); }
function time(value: unknown): string | null {
  const result = nullableString(value);
  if (result !== null && !Number.isFinite(Date.parse(result))) throw invalid();
  return result;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw invalid();
  return value;
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw invalid();
  return value.map(parse);
}
function action(value: unknown): OrderServiceAction {
  if (value === "accept" || value === "start_now" || value === "backfill_scheduled" || value === "backfill_custom" || value === "complete") return value;
  throw invalid();
}
export function parseOrderServiceEligibility(value: unknown): OrderServiceEligibility {
  const data = object(value);
  const checkedAt = time(data.checkedAt);
  const snapshot = string(data.snapshot);
  if (!checkedAt || !/^[A-Fa-f0-9]{64}$/.test(snapshot)) throw invalid();
  const actions = array(data.actions, (value) => {
    const a = object(value);
    return {
      action: action(a.action), enabled: boolean(a.enabled), reasonCode: nullableString(a.reasonCode), reason: nullableString(a.reason),
      targets: array(a.targets, (value) => {
        const t = object(value);
        return { id: string(t.id), name: string(t.name), staffId: string(t.staffId), version: number(t.version),
          status: string(t.status), skipped: boolean(t.skipped), purchasedMinutes: number(t.purchasedMinutes), restMinutes: number(t.restMinutes),
          startsAt: time(t.startsAt), endsAt: time(t.endsAt), busyUntil: time(t.busyUntil) };
      }),
      conflicts: array(a.conflicts, (value) => {
        const c = object(value);
        return { unitId: string(c.unitId), orderId: string(c.orderId), name: string(c.name), overlapMinutes: number(c.overlapMinutes), startsAt: time(c.startsAt), endsAt: time(c.endsAt) };
      }),
    };
  });
  if (actions.length !== 5 || new Set(actions.map(a => a.action)).size !== 5) throw invalid();
  return { orderId: string(data.orderId), flowVersion: number(data.flowVersion), snapshot, checkedAt, actions };
}

export async function getOrderServiceEligibility(id: string, signal: AbortSignal) {
  const result = parseOrderServiceEligibility(await adminRequest(`${path(id)}/service-eligibility`, { signal }));
  if (result.orderId !== id) throw invalid();
  return result;
}
export async function sendOrderServiceCommand(id: string, command: OrderServiceCommand) {
  const result = object(await adminRequest(`${path(id)}/service-command`, { method: "POST", body: JSON.stringify(command) }));
  if (result.orderId !== id || result.operationId !== command.operationId || typeof result.orderStatus !== "string" ||
      !Array.isArray(result.affectedIds) || !result.affectedIds.every(id => typeof id === "string")) throw invalid();
}
