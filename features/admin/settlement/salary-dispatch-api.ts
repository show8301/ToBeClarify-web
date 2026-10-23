import { adminRequest } from "@/features/admin/api/client.js";
import type { SalaryDispatch, SalaryDispatchItem, SaveSalaryDispatchRequest } from "./salary-dispatch-types";

const REQUEST_TIMEOUT_MS = 25_000;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("薪資派發資料格式錯誤。");
  return Object.fromEntries(Object.entries(value));
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("薪資派發文字資料格式錯誤。");
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("薪資派發金額或版本格式錯誤。");
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("薪資派發狀態格式錯誤。");
  return value;
}

function parseItem(value: unknown): SalaryDispatchItem {
  const row = object(value);
  const updatedAt = nullableText(row.updatedAt);
  if (updatedAt !== null && (!/(?:Z|[+-]\d{2}:\d{2})$/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)))) {
    throw new Error("薪資派發時間格式錯誤。");
  }
  return {
    staffId: text(row.staffId), displayName: text(row.displayName), salary: integer(row.salary),
    isPaid: boolean(row.isPaid), version: integer(row.version), updatedAt,
    updatedBy: nullableText(row.updatedBy), updatedByName: nullableText(row.updatedByName),
  };
}

export function parseSalaryDispatch(value: unknown): SalaryDispatch {
  const row = object(value);
  const businessDate = text(row.businessDate);
  const sessionNo = integer(row.sessionNo);
  const finalized = boolean(row.finalized);
  const settlementId = nullableText(row.settlementId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || sessionNo < 1 || !Array.isArray(row.items)
      || (finalized && !settlementId)) throw new Error("薪資派發營業範圍格式錯誤。");
  const items = row.items.map(parseItem);
  if (new Set(items.map(item => item.staffId)).size !== items.length || (!finalized && items.length > 0)) {
    throw new Error("薪資派發清單資料不一致。");
  }
  return { businessDate, sessionNo, settlementId, finalized, correctionVersion: integer(row.correctionVersion),
    inputVersion: integer(row.inputVersion), items };
}

export async function getSalaryDispatch(businessDate: string, sessionNo: number, signal: AbortSignal): Promise<SalaryDispatch> {
  const query = new URLSearchParams({ businessDate, sessionNo: String(sessionNo) });
  const result = parseSalaryDispatch(await adminRequest(`/settlement/salary-dispatch?${query}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  }));
  if (result.businessDate !== businessDate || result.sessionNo !== sessionNo) throw new Error("派發清單與目前營業時段不符。");
  return result;
}

export async function saveSalaryDispatch(request: SaveSalaryDispatchRequest, signal: AbortSignal): Promise<void> {
  // This endpoint explicitly returns 204 No Content; it does not create payment/recovery events.
  await adminRequest("/settlement/salary-dispatch", {
    method: "PUT", body: JSON.stringify(request),
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  });
}
