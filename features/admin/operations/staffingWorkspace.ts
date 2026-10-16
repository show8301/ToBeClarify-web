import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, ApiError } from "@/features/admin/api/client.js";
import { normalizeContext, normalizeStaffMember } from "./operationsData";
import { parseDutyPlans } from "./staffing";
import { errorText } from "./workbenchApi";
import { isRecord } from "./operationsFormat";
import type { OperationsContext, OperationsDutyPlan, OperationsStaffMember } from "./operationsTypes";

export type StaffingData = {
  context: OperationsContext | null;
  staff: OperationsStaffMember[];
  dutyPlans: OperationsDutyPlan[] | null;
  refreshedAt: number;
};
type StaffingState = {
  accountKey: string;
  status: "loading" | "ready" | "error";
  refreshing: boolean;
  error: string;
  data: StaffingData;
};

const emptyData: StaffingData = { context: null, staff: [], dutyPlans: null, refreshedAt: 0 };
const initialState: StaffingState = { accountKey: "", status: "loading", refreshing: false, error: "", data: emptyData };

export function useStaffingWorkspace(accountKey: string, canManage: boolean, refreshAuthentication: () => Promise<unknown>) {
  const [state, setState] = useState<StaffingState>(initialState);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);

  const reload = useCallback(async (background = false) => {
    if (!canManage || background && active.current) return;
    const current = ++generation.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState((previous) => ({ ...previous, accountKey, refreshing: true,
      data: previous.accountKey === accountKey ? previous.data : emptyData,
      status: background && previous.accountKey === accountKey && previous.status === "ready" ? "ready" : "loading", error: "" }));
    let stage = "營業日";
    try {
      const context = normalizeContext(await adminApi.getOrderingContext(controller.signal));
      if (!context) throw new Error("營業日回應格式異常。");
      // A changed date invalidates the old picker immediately, before the new roster finishes loading.
      if (!controller.signal.aborted) setState((previous) => ({ ...previous,
        status: previous.data.context?.referenceBusinessDate === context.referenceBusinessDate ? previous.status : "loading" }));
      stage = "店員資料";
      const value: unknown = await adminApi.getStaffMembers(controller.signal);
      if (!Array.isArray(value)) throw new Error("店員清單格式異常。");
      if (value.some((person) => !isRecord(person) || typeof person.id !== "string" || !person.id
        || typeof person.displayName !== "string" || typeof person.isWorkingToday !== "boolean" || typeof person.isActive !== "boolean")) {
        throw new Error("店員識別或執勤資料不完整。");
      }
      const parsed = value.map(normalizeStaffMember);
      if (parsed.some((person) => !person)) throw new Error("店員資料不完整。");
      const staff = parsed.filter((person): person is OperationsStaffMember => Boolean(person));
      if (new Set(staff.map((person) => person.id)).size !== staff.length) throw new Error("店員清單含重複資料。");
      stage = "班表";
      const dates = new Set([context.referenceBusinessDate, ...staff.filter((person) => person.isWorkingToday && person.todayWorkMode)
        .map((person) => person.todayWorkMode?.businessDate || context.referenceBusinessDate)]);
      const dutyPlans: OperationsDutyPlan[] = [];
      for (const date of dates) {
        const plans = parseDutyPlans(await adminApi.getDutyPlans({ from: date, to: date }, controller.signal));
        if (plans.some((plan) => plan.businessDate !== date)) throw new Error("班表與查詢日期不符。");
        dutyPlans.push(...plans);
      }
      if (!controller.signal.aborted && generation.current === current) setState({ accountKey, status: "ready", refreshing: false, error: "",
        data: { context, staff, dutyPlans, refreshedAt: Date.now() } });
    } catch (error) {
      if (!controller.signal.aborted && generation.current === current) {
        const reason = error instanceof ApiError && (error.status === 401 || error.status === 403)
          ? "登入或管理權限無法確認，請重新登入後再操作。"
          : `${stage}無法確認：${errorText(error)} 請重新讀取人力資料。`;
        setState((previous) => ({ ...previous, accountKey, status: "error", refreshing: false, error: reason }));
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          void refreshAuthentication().catch(() => { /* The auth provider owns session failure. */ });
        }
      }
    } finally { if (active.current === controller) active.current = null; }
  }, [accountKey, canManage, refreshAuthentication]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void reload(true); }, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void reload(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      generation.current += 1;
      active.current?.abort();
      active.current = null;
    };
  }, [reload]);

  return { ...(state.accountKey === accountKey ? state : initialState), reload };
}
