import type { TipDistributionInput } from "./TipDistributionFields";
import { adminRequest } from "@/features/admin/api/client.js";

export interface BackfillChoice {
  key: string;
  label: string;
  kind: "item" | "set" | "nomination" | "room" | "tip";
  referenceId: string;
  staffId?: string;
  serviceId?: string;
  unitPrice: number;
  basePrice?: number;
  duration?: number;
  isChampagneTower?: boolean;
}
export interface BackfillLine {
  id: string;
  choice: BackfillChoice;
  quantity: number;
  unitPrice: number;
  basePrice: number;
  startsAt: string;
  endsAt: string;
  staffPercentage: number;
  recipientStaffId?: string;
  distribution?: TipDistributionInput;
}
export interface BackfillRequest {
  backfill: {
    operationId: string; occurredAt: string; reason: string; linkedCashRecordId: string | null;
    expectedFinanceVersion: number; expectedCashRecordVersion: number | null;
  };
  meals: { kind: string; referenceId: string; quantity: number; unitPrice: number; recipientStaffId: string | null }[];
  nominations: { staffId: string; mode: string; serviceId: string | null; segmentCount: number;
    baseUnitPrice: number; serviceUnitPrice: number; requestedStartsAt: string; actualEndsAt: string }[];
  rooms: { roomId: string; segmentCount: number; unitPrice: number; requestedStartsAt: string; actualEndsAt: string }[];
  tips: { staffId: string | null; amount: number; staffPercentage: number; distributionMode?: string; allocations?: TipDistributionInput["allocations"] }[];
}
export interface BackfillQuote {
  quoteToken: string; totalAmount: number; mealCreditApplied: number; expiresAt: string;
  charges: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("資料格式不正確，請重新讀取。");
  return Object.fromEntries(Object.entries(value));
}
function str(value: unknown): string {
  if (typeof value !== "string") throw new Error("文字格式不正確。");
  return value;
}
function num(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("金額格式不正確。");
  return value;
}
function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("清單格式不正確。");
  return value.map(object);
}
function champagne(value: unknown): boolean { return Array.isArray(value) && value.includes("champagne_tower"); }
export function parseBackfillCatalog(value: unknown): { choices: BackfillChoice[]; segmentMinutes: number } {
  const row = object(value);
  const menu = object(row.menu);
  const settings = object(row.settings);
  const choices: BackfillChoice[] = [];
  for (const category of list(menu.categories)) for (const item of list(category.items)) {
    choices.push({ key: `item:${str(item.id)}`, kind: "item", referenceId: str(item.id),
      label: str(item.itemName), unitPrice: num(item.price), isChampagneTower: champagne(object(item.policy).eventCategories) });
  }
  for (const item of list(menu.sets)) choices.push({ key: `set:${str(item.id)}`, kind: "set",
    referenceId: str(item.id), label: str(item.setName), unitPrice: num(item.setPrice), isChampagneTower: champagne(item.effectiveEventCategories) });
  for (const staff of list(row.staff)) {
    const staffId = str(staff.id);
    const name = str(staff.displayName);
    choices.push({ key: `nomination:${staffId}`, kind: "nomination", referenceId: staffId, staffId,
      label: `${name}｜純陪伴`, unitPrice: 0, basePrice: num(settings.baseNominationFee) });
    for (const offer of [...list(staff.commonServices), ...list(staff.specialServices)]) {
      if (offer.price === null) continue;
      choices.push({ key: `service:${staffId}:${str(offer.id)}`, kind: "nomination", referenceId: staffId,
        staffId, serviceId: str(offer.id), label: `${name}｜${str(offer.serviceName)}`,
        unitPrice: num(offer.price), basePrice: num(settings.baseNominationFee),
        duration: offer.durationMinutes == null ? undefined : num(offer.durationMinutes) });
    }

  }
  for (const room of list(row.rooms)) choices.push({ key: `room:${str(room.id)}`, kind: "room",
    referenceId: str(room.id), label: `包廂｜${str(room.roomName)}`, unitPrice: num(room.segmentPrice) });
  choices.push({ key: "tip:staff", kind: "tip", referenceId: "", label: "小費｜員工分配", unitPrice: 100000 });
  return { choices, segmentMinutes: num(settings.segmentMinutes) };
}
export const backfillApi = {
  catalog: async (businessDate: string, signal: AbortSignal) => {
    const query = new URLSearchParams({ businessDate });
    return parseBackfillCatalog(await adminRequest(`/ordering-catalog?${query.toString()}`, { signal }));
  },
  quote: async (sessionId: string, body: BackfillRequest): Promise<BackfillQuote> => {
    const row = object(await adminRequest(`/order-sessions/${encodeURIComponent(sessionId)}/quote`,
      { method: "POST", body: JSON.stringify(body) }));
    return { quoteToken: str(row.quoteToken), totalAmount: num(row.totalAmount),
      mealCreditApplied: num(row.mealCreditApplied), expiresAt: str(row.expiresAt),
      charges: list(row.charges).map(x => ({ name: str(x.name), quantity: num(x.quantity),
        unitPrice: num(x.unitPrice), lineTotal: num(x.lineTotal) })) };
  },
  submit: async (sessionId: string, body: BackfillRequest & { quoteToken: string }): Promise<string> => {
    const row = object(await adminRequest(`/order-sessions/${encodeURIComponent(sessionId)}/orders`,
      { method: "POST", body: JSON.stringify(body) }));
    return str(row.orderNumber);
  },
};
