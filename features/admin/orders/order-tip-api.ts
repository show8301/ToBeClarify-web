import { adminRequest } from "@/features/admin/api/client.js";
import type { FinanceTipAllocation, FinanceTipDistributionMode } from "./finance-types";
import type { TipDistributionInput } from "./TipDistributionFields";

export interface OrderTip {
  orderId: string; orderNumber: string; itemId: string; amount: number; version: number;
  distribution: { mode: FinanceTipDistributionMode; allocations: FinanceTipAllocation[] } | null;
  staffName: string | null; staffAmount: number; storeAmount: number;
}
export interface TipCorrection extends TipDistributionInput {
  operationId: string; expectedAccountVersion: number; expectedDistributionVersion: number; reason: string;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("小費資料格式錯誤。");
  return Object.fromEntries(Object.entries(value));
};
const str = (value: unknown): string => { if (typeof value !== "string") throw new Error("小費文字格式錯誤。"); return value; };
const num = (value: unknown): number => { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("小費金額格式錯誤。"); return value; };
const array = (value: unknown): unknown[] => { if (!Array.isArray(value)) throw new Error("小費清單格式錯誤。"); return value; };
function parse(value: unknown): OrderTip {
  const row = object(value);
  let distribution: OrderTip["distribution"] = null;
  if (row.distribution !== null) {
    const d = object(row.distribution); const mode = d.mode;
    if (mode !== "equal" && mode !== "designated" && mode !== "custom") throw new Error("小費分配方式錯誤。");
    distribution = { mode, allocations: array(d.allocations).map(value => {
      const a = object(value);
      return { staffId: str(a.staffId), staffName: str(a.staffName), amount: num(a.amount), percentage: a.percentage === null ? null : num(a.percentage) };
    }) };
  }
  return { orderId: str(row.orderId), orderNumber: str(row.orderNumber), itemId: str(row.itemId), amount: num(row.amount), version: num(row.version),
    staffName: row.staffName === null ? null : str(row.staffName), staffAmount: num(row.staffAmount), storeAmount: num(row.storeAmount), distribution };
}
const path = (sessionId: string) => `/ordering-finance/sessions/${encodeURIComponent(sessionId)}/order-tips`;
export const orderTipApi = {
  list: async (sessionId: string, signal?: AbortSignal): Promise<OrderTip[]> => array(await adminRequest(path(sessionId), { signal })).map(parse),
  correct: (sessionId: string, itemId: string, body: TipCorrection) => adminRequest(`${path(sessionId)}/${encodeURIComponent(itemId)}`,
    { method: "PUT", body: JSON.stringify(body) }),
};
