"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "./presentation";

type Snapshot<T> = { key: string; data: T | null; error: string };

/** Keeps results scoped to the current query and aborts obsolete requests. */
export function useCustomerResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setSnapshot({ key, data, error: "" });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setSnapshot({ key, data: null, error: errorMessage(cause) });
    });
    return () => controller.abort();
  }, [key, load]);
  const current = snapshot?.key === key ? snapshot : null;
  return { data: current?.data ?? null, loading: current === null, error: current?.error ?? "" };
}
