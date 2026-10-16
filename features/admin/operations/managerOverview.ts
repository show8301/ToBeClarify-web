import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { financeApi } from "@/features/admin/orders/finance-api";
import type { FinanceAccount, FinanceCase } from "@/features/admin/orders/finance-types";
import { errorText, integer, list, record, textValue } from "./workbenchApi";
import type { OperationsData } from "./operationsTypes";

export type ManagerSettings = { reminderMinutes: number; escalateMinutes: number; nominationPaused: boolean; pausedUntil: string };
export type ManagerSettlement = {
  businessDate: string; sessionNo: number; status: string; payroll: number; companyIncome: number;
  grossRevenue: number; anomalies: string[];
  workflow: null | { periodId: string; periodStatus: string; activeServices: number; unfinished: number;
    cashReceived: number; cashRefunded: number; netCash: number; retained: number; pending: number; canClose: boolean; canFinalize: boolean };
};
export type ManagerFinance = { sessionId: string; account: FinanceAccount | null; cases: FinanceCase[]; error: string };
type Resource<T> = { data: T | null; error: string };
type Overview = { key: string; loading: boolean; settlementLoading: boolean; settings: Resource<ManagerSettings>; settlement: Resource<ManagerSettlement>; finance: ManagerFinance[] };

function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("營運金額格式異常。");
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("營運狀態格式異常。");
  return value;
}
function parseSettings(value: unknown): ManagerSettings {
  const s = record(value);
  return { reminderMinutes: integer(s.reminderAfterMinutes), escalateMinutes: integer(s.escalateAfterMinutes),
    nominationPaused: bool(s.nominationPaused), pausedUntil: s.nominationPausedUntil == null ? "" : textValue(s.nominationPausedUntil) };
}
function parseSettlement(value: unknown, date: string, sessionNo: number): ManagerSettlement {
  const s = record(value), run = record(s.run), summary = record(s.summary);
  if (run.businessDate !== date || run.sessionNo !== sessionNo) throw new Error("結算日期或時段已變更，請重新整理。");
  const w = s.workflow == null ? null : record(s.workflow);
  return {
    businessDate: date, sessionNo, status: textValue(run.status), payroll: amount(summary.totalPayroll),
    companyIncome: amount(summary.companyIncome), grossRevenue: amount(summary.grossRevenue),
    anomalies: list(s.anomalies, (entry) => textValue(record(entry).message)),
    workflow: w ? { periodId: w.businessPeriodId == null ? "" : textValue(w.businessPeriodId), periodStatus: textValue(w.periodStatus),
      activeServices: integer(w.activeServiceCount), unfinished: integer(w.unfinishedOrderCount), cashReceived: amount(w.cashReceived),
      cashRefunded: amount(w.cashRefunded), netCash: amount(w.netCash), retained: amount(w.retainedAmount), pending: integer(w.pendingFinanceCount),
      canClose: bool(w.canClose), canFinalize: bool(w.canFinalize) } : null,
  };
}

async function resource<T>(request: () => Promise<T>): Promise<Resource<T>> {
  try { return { data: await request(), error: "" }; }
  catch (error) { return { data: null, error: errorText(error) }; }
}

// Bound per-customer reads; refreshes and role/date changes cancel the entire batch.
async function loadFinance(ids: string[], signal: AbortSignal): Promise<ManagerFinance[]> {
  const result: ManagerFinance[] = [];
  for (let start = 0; start < ids.length; start += 4) {
    signal.throwIfAborted();
    const batch = await Promise.all(ids.slice(start, start + 4).map(async (sessionId) => {
      try {
        const [accountResult, casesResult] = await Promise.allSettled([financeApi.account(sessionId, signal), financeApi.cases(sessionId, false, signal)]);
        if (accountResult.status === "rejected") throw accountResult.reason;
        if (casesResult.status === "rejected") throw casesResult.reason;
        const account = accountResult.value, cases = casesResult.value;
        if (account.sessionId !== sessionId || cases.some((item) => item.sessionId !== sessionId)) throw new Error("帳款顧客與查詢不符。");
        return { sessionId, account, cases, error: "" };
      } catch (error) { return { sessionId, account: null, cases: [], error: errorText(error) }; }
    }));
    result.push(...batch);
  }
  return result;
}

export function useManagerOverview(data: OperationsData, sessionNo: number) {
  const date = data.context?.referenceBusinessDate || "";
  const ids = useMemo(() => data.sessions.map((s) => s.id), [data.sessions]);
  const key = `${date}:${sessionNo}:${data.refreshedAt}`;
  const [state, setState] = useState<Overview>({ key: "", loading: true, settlementLoading: true, settings: { data: null, error: "" }, settlement: { data: null, error: "" }, finance: [] });
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState({ key, loading: true, settlementLoading: true, settings: { data: null, error: "" }, settlement: { data: null, error: "" }, finance: [] });
      void resource(async () => parseSettings(await adminApi.getOrderingSettings(controller.signal))).then((settings) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, settings }));
      });
      void resource(async () => parseSettlement(await adminApi.getSettlement({ businessDate: date, sessionNo }, controller.signal), date, sessionNo)).then((settlement) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, settlement, settlementLoading: false }));
      });
      void loadFinance(ids, controller.signal).then((finance) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, finance, loading: false }));
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false,
          finance: ids.map((sessionId) => ({ sessionId, account: null, cases: [], error: errorText(error) })) }));
      });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [date, sessionNo, ids, key]);
  // Never display stale totals as current after a refresh or business-date change.
  return state.key === key ? state : { key, loading: true, settlementLoading: true, settings: { data: null, error: "" }, settlement: { data: null, error: "" }, finance: [] };
}

export function managerOrderRoute(date: string, sessionId?: string) {
  const query = new URLSearchParams({ date });
  if (sessionId) query.set("session", sessionId);
  return `/admin/orders?${query}`;
}

export function managerSettlementRoute(date: string, sessionNo: number) {
  return `/admin/settlement?${new URLSearchParams({ businessDate: date, sessionNo: String(sessionNo), tab: "operations" })}`;
}
