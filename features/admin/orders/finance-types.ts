export type FinanceKind = "charge_add" | "charge_reduce" | "cash_receipt" | "cash_refund";
export type FinanceSourceKind = "admission" | "order" | "item" | "unallocated";
export type FinanceAllocation = "pending" | "confirmed";
export type FinanceHoldScope = "none" | "session" | "order" | "item";

export interface FinanceRecord {
  id: string;
  version: number;
  kind: FinanceKind;
  amount: number;
  sourceKind: FinanceSourceKind;
  orderId: string | null;
  orderItemId: string | null;
  sourcePeriodId: string;
  cashPeriodId: string | null;
  occurredAt: string;
  allocationStatus: FinanceAllocation;
  holdScope: FinanceHoldScope;
  reason: string;
  reversesRecordId: string | null;
  caseId: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
}

export interface FinanceAccount {
  sessionId: string;
  sourcePeriodId: string | null;
  businessDate: string;
  flowVersion: number;
  version: number;
  canWrite: boolean;
  hasRecordedCash: boolean;
  admissionChargeRecorded: boolean;
  orderReceivable: number;
  chargeAdditions: number;
  chargeReductions: number;
  receivable: number;
  cashReceived: number;
  cashRefunded: number;
  netCash: number;
  balance: number;
  refundDue: number;
  unassignedNetCash: number;
  pendingCount: number;
  balanceIsProvisional: boolean;
  holdScope: FinanceHoldScope;
  records: FinanceRecord[];
}

export interface FinanceSaveRequest {
  operationId: string;
  expectedVersion: number;
  kind: FinanceKind;
  amount: number;
  sourceKind: FinanceSourceKind;
  orderId: string | null;
  orderItemId: string | null;
  sourcePeriodId: string | null;
  cashPeriodId: string | null;
  occurredAt: string;
  allocationStatus: FinanceAllocation;
  holdScope: FinanceHoldScope;
  reason: string;
  reversesRecordId: string | null;
}

export interface FinanceOperation { operationId: string; recordId: string; accountVersion: number }
export interface FinancePeriodOption { id: string; businessDate: string }
export interface FinanceOrderOption { id: string; orderNumber: string; items: { id: string; name: string }[] }
export interface FinanceRevision { version: number; operationId: string; recordedAt: string; recordedBy: string; record: FinanceRecord }

export interface AdmissionEntry {
  id: string; sessionId: string; amount: number; discountAmount: number; creditAmount: number;
  status: "received" | "unpaid" | "waived" | "reissue"; cashPeriodId: string | null;
  chargeRecordId: string | null; receiptRecordId: string | null; version: number; reason: string;
  createdAt: string; updatedAt: string;
}
export interface AdmissionSaveRequest {
  operationId: string; expectedVersion: number; amount: number; discountAmount: number;
  creditAmount: number; mode: AdmissionEntry["status"]; cashPeriodId: string | null; reason: string;
}
export interface FinanceCase {
  id: string; sessionId: string; recordId: string | null; orderId: string | null; orderItemId: string | null;
  caseKind: string; amount: number; profitScope: FinanceHoldScope; status: "open" | "resolved";
  sourcePeriodId: string; description: string; createdAt: string; createdBy: string; updatedAt: string;
  updatedBy: string; resolvedAt: string | null; resolvedBy: string | null; resolutionNote: string | null;
}
