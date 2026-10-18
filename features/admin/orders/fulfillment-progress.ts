export type FulfillmentReadState =
  | { kind: "loading" | "error" }
  | { kind: "ready"; orderStatus: string; allFinished: boolean; unfinishedCount: number; totalCount: number };

type UnitProgress = { status: string; quantity: number; completedQuantity: number; cancelledQuantity: number };

export function isFulfillmentUnitFinished(unit: UnitProgress): boolean {
  return ["completed", "cancelled"].includes(unit.status)
    && Number.isSafeInteger(unit.quantity) && unit.quantity > 0
    && Number.isSafeInteger(unit.completedQuantity) && unit.completedQuantity >= 0
    && Number.isSafeInteger(unit.cancelledQuantity) && unit.cancelledQuantity >= 0
    && unit.completedQuantity + unit.cancelledQuantity === unit.quantity;
}
