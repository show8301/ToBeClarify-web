export interface FulfillmentQuantityState {
  kind: string;
  version: number;
  quantity: number;
  acceptedQuantity: number;
  startedQuantity: number;
  completedQuantity: number;
  cancelledQuantity: number;
}

export interface FulfillmentDraft {
  quantity: number;
  reason: string;
  startsAt: string;
  targetBusinessPeriodId: string;
  actualStartsAt: string;
  actualEndsAt: string;
  restMinutes: number;
  compensationAmount: number;
  compensationReason: string;
}

export interface FulfillmentTransitionRequest {
  operationId: string;
  expectedVersion: number;
  action: string;
  quantity: number;
  reason: string | null;
  scheduledStartsAt: string | null;
  targetBusinessPeriodId: string | null;
  restMinutes: number;
  compensationAmount: number;
  compensationReason: string | null;
  actualStartsAt: string | null;
  actualEndsAt: string | null;
}

export function getFulfillmentQuantityLimit(unit: FulfillmentQuantityState, action: string): number {
  switch (action) {
    case "accept": return Math.max(0, unit.quantity - unit.cancelledQuantity - unit.acceptedQuantity);
    case "start": return Math.max(0, unit.acceptedQuantity - unit.startedQuantity);
    case "complete": return Math.max(0, unit.startedQuantity - unit.completedQuantity);
    case "cancel": return Math.max(0, unit.quantity - unit.cancelledQuantity - unit.startedQuantity);
    case "backfill": return Math.max(0, unit.quantity - unit.cancelledQuantity - unit.completedQuantity);
    case "carry_forward": return Math.max(0, unit.quantity - unit.cancelledQuantity);
    default: return unit.quantity;
  }
}

export function isWholeQuantityTransfer(unit: FulfillmentQuantityState, action: string): boolean {
  return action === "carry_forward" && (unit.kind === "meal" || unit.kind === "room");
}

export function fulfillmentActionNeedsReason(action: string): boolean {
  return ["cancel", "decline", "reschedule", "carry_forward", "backfill"].includes(action);
}

export function createFulfillmentTransition(
  unit: FulfillmentQuantityState,
  action: string,
  draft: FulfillmentDraft,
  operationId: string,
): FulfillmentTransitionRequest {
  const scheduling = action === "reschedule" || action === "carry_forward";
  const startingNow = action === "start_now";
  const backfilling = action === "backfill";
  const taipeiTime = (value: string) => value ? value + ":00+08:00" : null;
  return {
    operationId,
    expectedVersion: unit.version,
    action,
    quantity: isWholeQuantityTransfer(unit, action) ? getFulfillmentQuantityLimit(unit, action) : draft.quantity,
    reason: fulfillmentActionNeedsReason(action) || action === "complete" ? draft.reason.trim() || null : null,
    scheduledStartsAt: scheduling && unit.kind === "nominee" && (action === "reschedule" || Boolean(draft.targetBusinessPeriodId))
      ? taipeiTime(draft.startsAt) : null,
    targetBusinessPeriodId: scheduling ? draft.targetBusinessPeriodId || null : null,
    restMinutes: startingNow ? draft.restMinutes : -1,
    compensationAmount: startingNow ? draft.compensationAmount : 0,
    compensationReason: startingNow ? draft.compensationReason.trim() || null : null,
    actualStartsAt: backfilling ? taipeiTime(draft.actualStartsAt) : null,
    actualEndsAt: backfilling ? taipeiTime(draft.actualEndsAt) : null,
  };
}
