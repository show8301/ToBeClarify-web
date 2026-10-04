"use client";

import type { ButtonHTMLAttributes } from "react";

type AdminRefreshButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function AdminRefreshButton({ className = "", ...props }: AdminRefreshButtonProps) {
  return (
    <button
      type="button"
      aria-label="重整"
      className={`adminButton adminButton-secondary adminRefreshFloating ${className}`.trim()}
      {...props}
    >
      重整<span aria-hidden="true">↻</span>
    </button>
  );
}
