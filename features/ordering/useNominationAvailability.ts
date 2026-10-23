"use client";

import { useEffect, useRef, useState } from "react";
import { orderingApi } from "./api/client.js";
import { parseNominationAvailability } from "./nomination-availability";
import type { NominationAvailability } from "./nomination-availability";

const REFRESH_MS = 30_000;
const TIMEOUT_MS = 10_000;

export function useNominationAvailability(token: string, businessDate: string, revision: number) {
  const [result, setResult] = useState<{ token: string; businessDate: string; revision: number; data: NominationAvailability } | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const offset = useRef(0);

  useEffect(() => {
    let disposed = false;
    let pending: AbortController | null = null;
    const refresh = async () => {
      if (disposed || pending) return;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const data = parseNominationAvailability(await orderingApi.nominationAvailability(token, controller.signal));
        if (data.businessDate !== businessDate) throw new Error("營業日已變更，請重新讀取點餐資料。");
        if (!disposed) {
          setResult({ token, businessDate, revision, data });
          offset.current = Date.parse(data.checkedAt) - Date.now();
          setNow(Date.parse(data.checkedAt));
          setError("");
        }
      } catch (cause) {
        if (!disposed) {
          setResult(null);
          setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "暫時無法確認可預約時段，請稍後再試。");
        }
      } finally {
        window.clearTimeout(timeout);
        pending = null;
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const refreshTimer = window.setInterval(onVisible, REFRESH_MS);
    const clockTimer = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    window.addEventListener("pageshow", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      pending?.abort();
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, businessDate, revision]);

  const data = result?.token === token && result.businessDate === businessDate && result.revision === revision ? result.data : null;
  return { data, error, now };
}
