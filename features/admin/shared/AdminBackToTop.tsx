"use client";

import { useSyncExternalStore } from "react";

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

function shouldShowBackToTop() {
  return window.innerWidth <= 1020 && window.scrollY > Math.min(260, window.innerHeight * .34);
}

function serverVisibility() {
  return false;
}

function scrollToTop() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
}

export function AdminBackToTop() {
  const visible = useSyncExternalStore(subscribeToScroll, shouldShowBackToTop, serverVisibility);

  return (
    <button
      type="button"
      className={`adminFloatingTop${visible ? " is-visible" : ""}`}
      aria-label="回到頁面頂端"
      onClick={scrollToTop}
    >
      <span aria-hidden="true">↑</span><b>TOP</b>
    </button>
  );
}
