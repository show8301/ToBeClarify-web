"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "./presentation";

export function useCustomerMutation() {
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => controller.current?.abort(), []);

  async function perform<T>(action: (signal: AbortSignal) => Promise<T>, onSuccess: (result: T) => void) {
    if (controller.current && !controller.current.signal.aborted) return;
    const next = new AbortController();
    controller.current = next;
    setBusy(true);
    setError("");
    try {
      const result = await action(next.signal);
      if (!next.signal.aborted) onSuccess(result);
    } catch (cause) {
      if (!next.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!next.signal.aborted) setBusy(false);
      if (controller.current === next) controller.current = null;
    }
  }
  return { busy, error, perform };
}
