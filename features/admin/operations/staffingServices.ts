import { parseStaffCommitments } from "./staffingSafety";
import type { OperationsDutyPlan } from "./operationsTypes";

export async function loadStaffCommitments(plan: OperationsDutyPlan, signal: AbortSignal) {
  if (!plan.startsAt || !plan.endsAt || !Number.isFinite(Date.parse(plan.startsAt)) || !Number.isFinite(Date.parse(plan.endsAt))) {
    throw new Error("原班次時段不完整，請至值班規劃確認。");
  }
  // This uncached source includes reservations and order busy blocks across business periods.
  const query = new URLSearchParams({ from: plan.startsAt, to: plan.endsAt });
  const response = await fetch(`/api/live-status?${query}`, {
    cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  });
  if (!response.ok) throw new Error(`服務資料讀取失敗（HTTP ${response.status}）。`);
  const value: unknown = await response.json();
  return parseStaffCommitments(value, plan.staffId);
}
