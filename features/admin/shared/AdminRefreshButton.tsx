"use client";

import type { ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useAdminToolbarRefreshTarget } from "@/features/admin/shared/AdminToolbar";
import { AdminButton } from "./AdminButton";

type AdminRefreshButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { loading?: boolean };

export function AdminRefreshButton({ className = "", loading = false, ...props }: AdminRefreshButtonProps) {
  const refreshTarget = useAdminToolbarRefreshTarget();
  const button = (
    <AdminButton
      {...props}
      type="button"
      variant="secondary"
      aria-label={loading ? "重整中" : "重整"}
      className={`adminRefreshFloating ${className}`.trim()}
      busy={loading}
      busyLabel="重整中…"
    >
      重整<span aria-hidden="true">↻</span>
    </AdminButton>
  );

  // Preserve the page's handler and disabled state when presenting its action in the header.
  return refreshTarget ? createPortal(button, refreshTarget) : button;
}
