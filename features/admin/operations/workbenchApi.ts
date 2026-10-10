import { adminRequest } from "@/features/admin/api/client.js";

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("營業資料格式異常，請重新整理。");
  return value as Record<string, unknown>;
}

export function textValue(value: unknown): string {
  if (typeof value !== "string") throw new Error("營業資料缺少必要文字欄位。");
  return value;
}

export function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("營業資料的數量格式異常。");
  return value;
}

export function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("營業清單格式異常。");
  return value.map(parse);
}

function dateValue(value: unknown): string {
  if (value == null) return "";
  const result = textValue(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error("營業資料的時間格式異常。");
  return result;
}

export type WorkbenchUnit = {
  id: string; nomineeId: string; staffId: string; kind: string; name: string;
  status: string; version: number; quantity: number; acceptedQuantity: number;
  startedQuantity: number; completedQuantity: number; cancelledQuantity: number;
  scheduledStartsAt: string; scheduledEndsAt: string; actualStartsAt: string; actualEndsAt: string;
  originalScheduledStartsAt: string; originalScheduledEndsAt: string;
  purchasedMinutes: number; restMinutesReserved: number; allowedActions: string[];
  fulfillmentPeriodId: string;
};

export function parseUnits(value: unknown): WorkbenchUnit[] {
  return list(record(value).units, (entry) => {
    const u = record(entry);
    const version = integer(u.version);
    if (version < 1) throw new Error("服務資料版本異常。");
    return {
      id: textValue(u.id), nomineeId: u.nomineeId == null ? "" : textValue(u.nomineeId),
      staffId: u.staffId == null ? "" : textValue(u.staffId), kind: textValue(u.kind),
      name: textValue(u.name), status: textValue(u.status), version,
      quantity: integer(u.quantity), acceptedQuantity: integer(u.acceptedQuantity),
      startedQuantity: integer(u.startedQuantity), completedQuantity: integer(u.completedQuantity),
      cancelledQuantity: integer(u.cancelledQuantity), purchasedMinutes: integer(u.purchasedMinutes),
      restMinutesReserved: integer(u.restMinutesReserved),
      fulfillmentPeriodId: u.fulfillmentPeriodId == null ? "" : textValue(u.fulfillmentPeriodId),
      scheduledStartsAt: dateValue(u.scheduledStartsAt), scheduledEndsAt: dateValue(u.scheduledEndsAt),
      actualStartsAt: dateValue(u.actualStartsAt), actualEndsAt: dateValue(u.actualEndsAt),
      originalScheduledStartsAt: dateValue(u.originalScheduledStartsAt), originalScheduledEndsAt: dateValue(u.originalScheduledEndsAt),
      allowedActions: list(u.allowedActions, textValue),
    };
  });
}

export type StartPreview = {
  canStartNow: boolean; effectiveStartsAt: string; effectiveEndsAt: string;
  purchasedMinutes: number; restMinutesReserved: number; conflicts: string[];
};

export function parseStartPreview(value: unknown): StartPreview {
  const p = record(value);
  if (typeof p.canStartNow !== "boolean") throw new Error("接待預覽格式異常。");
  return {
    canStartNow: p.canStartNow, effectiveStartsAt: dateValue(p.effectiveStartsAt),
    effectiveEndsAt: dateValue(p.effectiveEndsAt), purchasedMinutes: integer(p.purchasedMinutes),
    restMinutesReserved: integer(p.restMinutesReserved),
    conflicts: list(p.conflicts, (entry) => {
      const c = record(entry);
      return `${textValue(c.name)}（重疊 ${integer(c.overlapMinutes)} 分鐘）`;
    }),
  };
}

export const fulfillmentPath = (orderId: string, unitId?: string) =>
  `/orders/${encodeURIComponent(orderId)}/fulfillment${unitId ? `/${encodeURIComponent(unitId)}` : ""}`;

export const workbenchApi = {
  units: async (id: string, signal?: AbortSignal) => parseUnits(await adminRequest(fulfillmentPath(id), { signal })),
  respond: (orderId: string, nomineeId: string, body: { operationId: string; expectedVersion: number; decision: "accept" | "decline"; reason: string | null }) =>
    adminRequest(`/orders/${encodeURIComponent(orderId)}/nominees/${encodeURIComponent(nomineeId)}/response`, { method: "POST", body: JSON.stringify(body) }),
  preview: async (orderId: string, unitId: string, signal?: AbortSignal) =>
    parseStartPreview(await adminRequest(`${fulfillmentPath(orderId, unitId)}/start-preview`, { signal })),
};

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "操作失敗，請重新整理確認目前狀態。";
}

export const serviceStatusLabels: Record<string, string> = {
  waiting: "待我確認", confirmed: "已承接", accepted: "已承接", in_service: "服務中",
  completed: "已完成", cancelled: "已取消", needs_coordination: "經理協調中",
  carried_forward: "保留待安排", needs_reschedule: "待協調時間",
};
