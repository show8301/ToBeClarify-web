"use client";

import type { ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useAdminToolbarRefreshTarget } from "@/features/admin/shared/AdminToolbar";

type AdminRefreshButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function AdminRefreshButton({ className = "", ...props }: AdminRefreshButtonProps) {
  const refreshTarget = useAdminToolbarRefreshTarget();
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
  return refreshTarget ? createPortal(button, refreshTarget) : button;
}
