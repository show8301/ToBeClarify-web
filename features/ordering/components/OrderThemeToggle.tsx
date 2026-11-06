"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "lucid-dream-order-theme";

export function useOrderTheme() {
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        setIsDark(window.localStorage.getItem(THEME_KEY) === "dark");
      } catch {
        setIsDark(false);
      }
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.orderTheme = isDark ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch {
      // The selected mode still works for this page when storage is unavailable.
    }
  }, [isDark, ready]);

  useEffect(() => () => { delete document.documentElement.dataset.orderTheme; }, []);

  return { isDark, ready, toggle: () => setIsDark(current => !current) };
}

export function OrderThemeToggle({ isDark, ready, onToggle }: {
  isDark: boolean;
  ready: boolean;
  onToggle: () => void;
}) {
  const label = isDark ? "切換為淺色模式" : "切換為暗色模式";
  return <button className="orderThemeToggle" type="button" aria-label={label} title={label}
    aria-pressed={isDark} disabled={!ready} onClick={onToggle}>{isDark ? "☀" : "☾"}</button>;
}
