import { adminRequest, ApiError } from "@/features/admin/api/client.js";
import type {
  FinanceAccount, FinanceAllocation, FinanceHoldScope, FinanceKind, FinanceOperation,
  FinanceOrderOption, FinancePeriodOption, FinanceRecord, FinanceRevision, FinanceSaveRequest, FinanceSourceKind,
  AdmissionEntry, AdmissionSaveRequest, FinanceCase,
} from "./finance-types";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object");
  return Object.fromEntries(Object.entries(value));
}
function str(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected string");
  return value;
}
function nullable(value: unknown): string | null { return value === null ? null : str(value); }
function num(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("Expected integer");
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Expected boolean");
  return value;
}
function array<T>(value: unknown, parse: (entry: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Expected array");
  return value.map(parse);
}
export function financeKind(value: unknown): FinanceKind {
  if (value === "charge_add" || value === "charge_reduce" || value === "cash_receipt" || value === "cash_refund") return value;
  throw new Error("Invalid finance kind");
}
export function financeSource(value: unknown): FinanceSourceKind {
  if (value === "admission" || value === "order" || value === "item" || value === "unallocated") return value;
  throw new Error("Invalid finance source");
}
export function financeAllocation(value: unknown): FinanceAllocation {
  if (value === "pending" || value === "confirmed") return value;
  throw new Error("Invalid allocation");
}
function holdScope(value: unknown): FinanceHoldScope {
  if (value === "none" || value === "session" || value === "order" || value === "item") return value;
  throw new Error("Invalid hold scope");
}
function parseRecord(value: unknown): FinanceRecord {
  const row = object(value);
  return {
    id: str(row.id), version: num(row.version), kind: financeKind(row.kind), amount: num(row.amount),
    sourceKind: financeSource(row.sourceKind), orderId: nullable(row.orderId), orderItemId: nullable(row.orderItemId),
    sourcePeriodId: str(row.sourcePeriodId), cashPeriodId: nullable(row.cashPeriodId), occurredAt: str(row.occurredAt),
    allocationStatus: financeAllocation(row.allocationStatus), holdScope: holdScope(row.holdScope), reason: str(row.reason),
    reversesRecordId: nullable(row.reversesRecordId), caseId: nullable(row.caseId), createdAt: str(row.createdAt), createdBy: str(row.createdBy),
    updatedAt: str(row.updatedAt), updatedBy: str(row.updatedBy), confirmedAt: nullable(row.confirmedAt), confirmedBy: nullable(row.confirmedBy),
  };
}
function parseAccount(value: unknown): FinanceAccount {
  const row = object(value);
  return {
    sessionId: str(row.sessionId), sourcePeriodId: nullable(row.sourcePeriodId), businessDate: str(row.businessDate),
    flowVersion: num(row.flowVersion), version: num(row.version), canWrite: bool(row.canWrite),
    hasRecordedCash: bool(row.hasRecordedCash), admissionChargeRecorded: bool(row.admissionChargeRecorded),
    orderReceivable: num(row.orderReceivable), chargeAdditions: num(row.chargeAdditions), chargeReductions: num(row.chargeReductions),
    receivable: num(row.receivable), cashReceived: num(row.cashReceived), cashRefunded: num(row.cashRefunded), netCash: num(row.netCash),
    balance: num(row.balance), refundDue: num(row.refundDue), unassignedNetCash: num(row.unassignedNetCash),
    pendingCount: num(row.pendingCount), balanceIsProvisional: bool(row.balanceIsProvisional), holdScope: holdScope(row.holdScope),
    records: array(row.records, parseRecord),
  };
}
function parseOperation(value: unknown): FinanceOperation {
  const row = object(value);
  return { operationId: str(row.operationId), recordId: str(row.recordId), accountVersion: num(row.accountVersion) };
}
function parseAdmission(value: unknown): AdmissionEntry | null {
  if (value === null) return null;
  const row = object(value); const status = str(row.status);
  if (!['received','unpaid','waived','reissue'].includes(status)) throw new Error('Invalid admission status');
  return { id:str(row.id), sessionId:str(row.sessionId), amount:num(row.amount), discountAmount:num(row.discountAmount),
    creditAmount:num(row.creditAmount), status:status as AdmissionEntry['status'], cashPeriodId:nullable(row.cashPeriodId),
    chargeRecordId:nullable(row.chargeRecordId), receiptRecordId:nullable(row.receiptRecordId), version:num(row.version),
    reason:str(row.reason), createdAt:str(row.createdAt), updatedAt:str(row.updatedAt) };
}
function parseCase(value: unknown): FinanceCase {
  const row = object(value); const status = str(row.status);
  if (status !== 'open' && status !== 'resolved') throw new Error('Invalid case status');
  return { id:str(row.id), sessionId:str(row.sessionId), recordId:nullable(row.recordId), orderId:nullable(row.orderId), orderItemId:nullable(row.orderItemId),
    caseKind:str(row.caseKind), amount:num(row.amount), profitScope:holdScope(row.profitScope), status, sourcePeriodId:str(row.sourcePeriodId),
    description:str(row.description), createdAt:str(row.createdAt), createdBy:str(row.createdBy), updatedAt:str(row.updatedAt), updatedBy:str(row.updatedBy),
    resolvedAt:nullable(row.resolvedAt), resolvedBy:nullable(row.resolvedBy), resolutionNote:nullable(row.resolutionNote) };
}
async function request<T>(path: string, parse: (value: unknown) => T, options: RequestInit = {}): Promise<T> {
  const value: unknown = await adminRequest(path, options);
  try { return parse(value); }
  catch { throw new ApiError("帳款回應格式不正確，請查回操作結果。", { status: 502, code: "INVALID_RESPONSE" }); }
}
const base = (id: string) => `/ordering-finance/sessions/${encodeURIComponent(id)}`;
export const financeApi = {
  account: (id: string, signal?: AbortSignal) => request(base(id), parseAccount, { signal }),
  periods: (id: string, signal?: AbortSignal) => request(`${base(id)}/period-options`, value => array(value, entry => {
    const row = object(entry);
    const result: FinancePeriodOption = { id: str(row.id), businessDate: str(row.businessDate) };
    return result;
  }), { signal }),
  orders: (id: string, signal?: AbortSignal) => request(`/order-sessions/${encodeURIComponent(id)}/orders`, value => array(value, entry => {
    const row = object(entry);
    const result: FinanceOrderOption = { id: str(row.id), orderNumber: str(row.orderNumber), items: array(row.items, item => {
      const fields = object(item);
      return { id: str(fields.id), name: str(fields.name) };
    }) };
    return result;
  }), { signal }),
  save: (id: string, recordId: string | null, body: FinanceSaveRequest, signal?: AbortSignal) => request(
    `${base(id)}/records${recordId ? `/${encodeURIComponent(recordId)}` : ""}`, parseOperation,
    { method: recordId ? "PUT" : "POST", body: JSON.stringify(body), signal },
  ),
  operation: (id: string, operationId: string, signal?: AbortSignal) => request(
    `${base(id)}/operations/${encodeURIComponent(operationId)}`, value => value === null ? null : parseOperation(value), { signal },
  ),
  revisions: (id: string, recordId: string, signal?: AbortSignal) => request(
    `${base(id)}/records/${encodeURIComponent(recordId)}/revisions`, value => array(value, entry => {
      const row = object(entry);
      const result: FinanceRevision = { version: num(row.version), operationId: str(row.operationId), recordedAt: str(row.recordedAt),
        recordedBy: str(row.recordedBy), record: parseRecord(row.record) };
      return result;
    }), { signal },
  ),
  admission: (id: string, signal?: AbortSignal) => request(`${base(id)}/admission`, parseAdmission, { signal }),
  saveAdmission: (id: string, body: AdmissionSaveRequest, signal?: AbortSignal) => request(`${base(id)}/admission`, value => {
    const row = object(value); return { operationId:str(row.operationId), admissionId:str(row.admissionId), chargeRecordId:nullable(row.chargeRecordId), receiptRecordId:nullable(row.receiptRecordId), accountVersion:num(row.accountVersion) };
  }, { method:'POST', body:JSON.stringify(body), signal }),
  cases: (id: string, includeResolved = false, signal?: AbortSignal) => request(`${base(id)}/cases?includeResolved=${includeResolved}`, value => array(value, parseCase), { signal }),
  resolveCase: (id: string, caseId: string, body: { operationId:string; expectedVersion:number; cashPeriodId:string|null; resolutionNote:string }, signal?: AbortSignal) => request(`${base(id)}/cases/${encodeURIComponent(caseId)}/resolve`, value => {
    const row = object(value); return { operationId:str(row.operationId), caseId:str(row.caseId), accountVersion:num(row.accountVersion) };
  }, { method:'POST', body:JSON.stringify(body), signal }),
  departure: (id: string, body: { operationId:string; action:'depart'|'void'|'reopen'|'reissue'; reason:string }, signal?: AbortSignal) => request(`${base(id)}/departure`, value => {
    const row = object(value); return { sessionId:str(row.sessionId), entryStatus:str(row.entryStatus), sessionStatus:str(row.sessionStatus), canOrder:bool(row.canOrder), departedAt:nullable(row.departedAt), reason:nullable(row.reason) };
  }, { method:'POST', body:JSON.stringify(body), signal }),
};
