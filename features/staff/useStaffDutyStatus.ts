"use client";

import { useEffect, useState } from "react";
import { parseStaffDutyStatuses } from "./duty-status";
import type { StaffDutyStatus } from "./types";

const REFRESH_INTERVAL = 60_000;
const REQUEST_TIMEOUT = 7_000;

export function useStaffDutyStatus() {
  const [statuses, setStatuses] = useState<Map<string, StaffDutyStatus> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let pending: AbortController | null = null;

    async function refresh() {
      if (pending || disposed) return;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const response = await fetch("/api/staff/status", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to refresh staff duty status");
        const result = parseStaffDutyStatuses(await response.json());
        if (!disposed) {
          setStatuses(new Map(result.map((item) => [item.id, item])));
          setFailed(false);
        }
      } catch {
        if (!disposed) {
          setStatuses(null);
          setFailed(true);
        }
      } finally {
        window.clearTimeout(timeout);
        pending = null;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const interval = window.setInterval(onVisible, REFRESH_INTERVAL);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      pending?.abort();
    };
  }, []);

  return (id: string) => {
    const status = statuses?.get(id);
    return {
      isWorkingToday: status?.isWorkingToday ?? false,
      isNominatable: status?.isNominatable ?? false,
      label: status ? (status.isWorkingToday ? "ON DUTY" : "OFF DUTY") : "STATUS",
      statusText: status?.statusText || (failed || statuses ? "狀態暫無法確認" : "確認執勤狀態中"),
    };
  };
}
