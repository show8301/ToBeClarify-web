import type { AdmissionCreationMode, AdmissionCreationResult, AdmissionPolicy, AdmissionPreview } from "./admission-creation-types.ts";
import type { IssuedAdmissionSession } from "./admission-creation-types.ts";

export function parseIssuedAdmission(value: unknown): IssuedAdmissionSession {
  const row = object(value);
  const session = object(row.session);
  return { session: { id: text(session.id), gameId: text(session.gameId), customerName: text(session.customerName) },
    orderUrl: text(row.orderUrl), orderToken: text(row.orderToken), recoveryCode: text(row.recoveryCode) };
}

export function parseAdmissionCreated(value: unknown) {
  const row = object(value);
  const result = parseAdmissionCreationResult(row.result);
  const issued = row.issued === null ? null : parseIssuedAdmission(row.issued);
  if (issued && issued.session.id !== result.sessionId) return invalid();
  return { issued: issued ? { ...issued, admission: result } : null, result };
}

function invalid(): never {
  throw new Error("入場收費資料格式不正確，請重新讀取確認。");
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return Object.fromEntries(Object.entries(value));
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : invalid();
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : invalid();
}

function money(value: unknown): number {
  return integer(value, 1_000_000_000_000);
}

function credit(value: unknown): number {
  return integer(value, 2_147_483_647);
}

function boolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : invalid();
}

function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) ||
      new Date(result).toISOString().slice(0, 10) !== result) return invalid();
  return result;
}

function instant(value: unknown): string {
  const result = text(value);
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(result) && Number.isFinite(Date.parse(result)) ? result : invalid();
}

function mode(value: unknown): AdmissionCreationMode {
  return value === "received" || value === "unpaid" || value === "waived" ? value : invalid();
}

export function parseAdmissionPolicy(value: unknown): AdmissionPolicy {
  const row = object(value);
  if (row.amountSource !== "ordering_admission_policy" || row.creditSource !== "ordering_settings.minimum_meal_credit") return invalid();
  return {
    admissionAmount: row.admissionAmount === null ? null : money(row.admissionAmount),
    version: integer(row.version), mealCreditAmount: credit(row.mealCreditAmount),
    amountSource: row.amountSource, creditSource: row.creditSource,
  };
}

export function parseAdmissionPreview(value: unknown): AdmissionPreview {
  const row = object(value);
  if (row.contractVersion !== 1 || typeof row.pricingRevision !== "string" || !/^[a-f0-9]{64}$/.test(row.pricingRevision)) return invalid();
  const periodVersion = integer(row.periodVersion);
  if (periodVersion < 1) return invalid();
  return {
    contractVersion: 1, businessPeriodId: text(row.businessPeriodId), businessDate: date(row.businessDate),
    periodVersion, policyVersion: integer(row.policyVersion), admissionAmount: money(row.admissionAmount),
    mealCreditAmount: credit(row.mealCreditAmount), expiresAt: instant(row.expiresAt), pricingRevision: row.pricingRevision,
    confirmedCreationAvailable: boolean(row.confirmedCreationAvailable), legacyCreationAllowed: boolean(row.legacyCreationAllowed),
  };
}

export function parseAdmissionCreationResult(value: unknown): AdmissionCreationResult {
  const row = object(value);
  if (row.credentialAction !== "explicit_reissue_if_needed") return invalid();
  const result: AdmissionCreationResult = {
    operationId: text(row.operationId), sessionId: text(row.sessionId), admissionId: text(row.admissionId),
    businessPeriodId: text(row.businessPeriodId), businessDate: date(row.businessDate),
    admissionAmount: money(row.admissionAmount), discountAmount: money(row.discountAmount),
    mealCreditAmount: credit(row.mealCreditAmount), admissionStatus: mode(row.admissionStatus),
    receivedAmount: money(row.receivedAmount), chargeRecordId: nullableText(row.chargeRecordId),
    receiptRecordId: nullableText(row.receiptRecordId), cashPeriodId: nullableText(row.cashPeriodId),
    accountVersion: integer(row.accountVersion), recordedAt: instant(row.recordedAt), recordedBy: text(row.recordedBy),
    credentialAction: row.credentialAction,
  };
  if (result.discountAmount > result.admissionAmount ||
      result.receivedAmount !== (result.admissionStatus === "received" ? result.admissionAmount - result.discountAmount : 0) ||
      result.admissionStatus === "waived" && result.discountAmount !== result.admissionAmount ||
      result.receivedAmount > 0 && (!result.receiptRecordId || !result.cashPeriodId)) return invalid();
  return result;
}
