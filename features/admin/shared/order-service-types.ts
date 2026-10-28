export type OrderServiceAction = "accept" | "start_now" | "backfill_scheduled" | "backfill_custom" | "complete";

export interface OrderServiceTarget {
  id: string;
  name: string;
  staffId: string;
  version: number;
  status: string;
  skipped: boolean;
  purchasedMinutes: number;
  restMinutes: number;
  startsAt: string | null;
  endsAt: string | null;
  busyUntil: string | null;
}

export interface OrderServiceEligibility {
  orderId: string;
  flowVersion: number;
  snapshot: string;
  checkedAt: string;
  actions: Array<{
    action: OrderServiceAction;
    enabled: boolean;
    reasonCode: string | null;
    reason: string | null;
    targets: OrderServiceTarget[];
    conflicts: Array<{ unitId: string; orderId: string; name: string; overlapMinutes: number; startsAt: string | null; endsAt: string | null }>;
  }>;
}

export interface OrderServiceCommand {
  operationId: string;
  snapshot: string;
  action: OrderServiceAction;
  reason: string | null;
  actualTimes: Array<{ id: string; startsAt: string; endsAt: string | null; stillInProgress: boolean }>;
}
