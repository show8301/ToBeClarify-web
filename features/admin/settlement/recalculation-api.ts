import { adminRequest } from "@/features/admin/api/client.js";
import type { RecalculationAdjustments, RecalculationConfirmation, RecalculationHistory, RecalculationPreview } from "./recalculation-types";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("重新結算資料格式錯誤。");
  return Object.fromEntries(Object.entries(value));
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("重新結算文字資料格式錯誤。");
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new Error("重新結算數值格式錯誤。");
  }
  return value;
}
function integer(value: unknown): number {
  const result = number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("重新結算版本或分鐘格式錯誤。");
  return result;
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("重新結算清單格式錯誤。");
  return value.map(parse);
}
function nullableText(value: unknown): string | null { return value == null ? null : text(value); }
function nullableMinutes(value: unknown): number | null { return value === null ? null : integer(value); }
function nullableNumber(value: unknown): number | null { return value == null ? null : number(value); }
function optionalArray<T>(value: unknown, parse: (item: unknown) => T): T[] | null {
  return value == null ? null : array(value, parse);
}

export function parseRecalculationPreview(value: unknown): RecalculationPreview {
  const row = object(value);
  const sourceToken = text(row.sourceToken);
  if (!/^[a-f0-9]{64}$/i.test(sourceToken) || typeof row.hasChanges !== "boolean") {
    throw new Error("重新結算預覽版本無效，請重新讀取。");
  }
  return {
    businessDate: text(row.businessDate), sessionNo: integer(row.sessionNo), sourceToken,
    correctionVersion: integer(row.correctionVersion), hasChanges: row.hasChanges,
    previousPayroll: number(row.previousPayroll), correctedPayroll: number(row.correctedPayroll),
    payrollDelta: number(row.payrollDelta), previousNetCash: number(row.previousNetCash),
    correctedNetCash: number(row.correctedNetCash), previousCompanyIncome: number(row.previousCompanyIncome),
    correctedCompanyIncome: number(row.correctedCompanyIncome),
    previousRuleVersionId: nullableText(row.previousRuleVersionId), correctedRuleVersionId: nullableText(row.correctedRuleVersionId),
    previousRuleEffectiveFrom: nullableText(row.previousRuleEffectiveFrom), correctedRuleEffectiveFrom: nullableText(row.correctedRuleEffectiveFrom),
    changes: array(row.changes, value => {
      const item = object(value);
      return {
        staffId: nullableText(item.staffId), displayName: text(item.displayName), role: text(item.role),
        previousMinutes: nullableMinutes(item.previousMinutes), correctedMinutes: nullableMinutes(item.correctedMinutes),
        previousHours: number(item.previousHours), correctedHours: number(item.correctedHours),
        previousPay: number(item.previousPay), correctedPay: number(item.correctedPay), payDelta: number(item.payDelta),
        previousActivityHours: nullableNumber(item.previousActivityHours), correctedActivityHours: nullableNumber(item.correctedActivityHours),
      };
    }),
    balances: array(row.balances, value => {
      const item = object(value);
      return {
        staffId: text(item.staffId), displayName: text(item.displayName), correctedPay: number(item.correctedPay),
        netPaid: number(item.netPaid), manualCorrection: number(item.manualCorrection), outstanding: number(item.outstanding),
      };
    }),
    anomalies: array(row.anomalies, value => {
      const item = object(value);
      return {
        code: text(item.code), message: text(item.message), sourceId: nullableText(item.sourceId),
        staffName: nullableText(item.staffName), sessionId: nullableText(item.sessionId),
        customerName: nullableText(item.customerName), orderId: nullableText(item.orderId),
        orderNumber: nullableText(item.orderNumber),
        orders: optionalArray(item.orders, orderValue => {
          const order = object(orderValue);
          return { orderId: text(order.orderId), orderNumber: text(order.orderNumber) };
        }),
        financeSources: optionalArray(item.financeSources, sourceValue => {
          const source = object(sourceValue);
          return {
            id: text(source.id), sourceKind: text(source.sourceKind), kind: text(source.kind), amount: number(source.amount),
            reason: nullableText(source.reason), allocationStatus: text(source.allocationStatus), holdScope: text(source.holdScope),
            orderId: nullableText(source.orderId), orderNumber: nullableText(source.orderNumber),
            orderItemId: nullableText(source.orderItemId), itemName: nullableText(source.itemName),
          };
        }),
      };
    }),
    existingCorrections: array(row.existingCorrections, value => {
      const item = object(value);
      return { staffId: nullableText(item.staffId), amountDelta: number(item.amountDelta), reason: text(item.reason) };
    }),
  };
}

export async function previewRecalculation(businessDate: string, sessionNo: number, adjustments: RecalculationAdjustments | undefined, signal: AbortSignal) {
  const result = parseRecalculationPreview(await adminRequest("/settlement/recalculation/preview", {
    method: "POST", body: JSON.stringify({ businessDate, sessionNo, adjustments }), signal,
  }));
  if (result.businessDate !== businessDate || result.sessionNo !== sessionNo) throw new Error("預覽與目前營業時段不符。");
  return result;
}

export async function confirmRecalculation(request: RecalculationConfirmation): Promise<void> {
  await adminRequest("/settlement/recalculation/confirm", { method: "POST", body: JSON.stringify(request) });
}

export async function getRecalculationHistory(businessDate: string, sessionNo: number, signal: AbortSignal) {
  const query = new URLSearchParams({ businessDate, sessionNo: String(sessionNo) });
  return array<RecalculationHistory>(await adminRequest(`/settlement/recalculation/history?${query}`, { signal }), value => {
    const item = object(value);
    return {
      id: text(item.id), version: integer(item.version), previousPayroll: number(item.previousPayroll),
      correctedPayroll: number(item.correctedPayroll), payrollDelta: number(item.payrollDelta),
      reason: text(item.reason), actorId: text(item.actorId), createdAt: text(item.createdAt),
    };
  });
}
