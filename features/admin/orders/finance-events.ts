export const FINANCE_UPDATED = "admin-finance-updated";

export function notifyFinanceUpdated(path: string) {
  if (typeof window === "undefined") return;
  const match = /^\/ordering-finance\/sessions\/([^/]+)/.exec(path);
  if (match) window.dispatchEvent(new CustomEvent(FINANCE_UPDATED, { detail: { sessionId: decodeURIComponent(match[1]) } }));
}

export function isFinanceUpdateFor(event: Event, sessionId: string) {
  if (!(event instanceof CustomEvent)) return false;
  const detail: unknown = event.detail;
  return Boolean(detail && typeof detail === "object" && "sessionId" in detail && detail.sessionId === sessionId);
}
