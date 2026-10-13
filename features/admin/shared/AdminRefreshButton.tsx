"use client";

import type { ButtonHTMLAttributes } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAdminToolbarRefreshTarget } from "@/features/admin/shared/AdminToolbar";

type AdminRefreshButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

const narrowToolbarQuery = "(max-width: 1020px)";

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(narrowToolbarQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isNarrowViewport() {
  return window.matchMedia(narrowToolbarQuery).matches;
}

function serverViewport() {
  return false;
}

export function AdminRefreshButton({ className = "", ...props }: AdminRefreshButtonProps) {
  const refreshTarget = useAdminToolbarRefreshTarget();
  const isNarrow = useSyncExternalStore(subscribeToViewport, isNarrowViewport, serverViewport);
  const button = (
    <button
      type="button"
      aria-label="重整"
      className={`adminButton adminButton-secondary adminRefreshFloating ${className}`.trim()}
      {...props}
    >
      重整<span aria-hidden="true">↻</span>
    </button>
  );

  // Preserve the page's handler and disabled state when presenting its action in the header.
  return isNarrow && refreshTarget ? createPortal(button, refreshTarget) : button;
}
