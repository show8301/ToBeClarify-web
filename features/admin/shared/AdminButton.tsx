"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  busy?: boolean;
  busyLabel?: ReactNode;
  disabledReason?: string;
};

export function AdminButton({
  children, variant = "primary", className = "", type = "button",
  disabled = false, busy = false, busyLabel, disabledReason, title,
  "aria-busy": ariaBusy, ...props
}: AdminButtonProps) {
  const processing = busy || ariaBusy === true || ariaBusy === "true";
  const unavailable = disabled || processing;
  return <button
    {...props}
    type={type}
    className={`adminButton adminButton-${variant} ${className}`.trim()}
    disabled={unavailable}
    aria-busy={processing ? true : ariaBusy}
    title={unavailable && disabledReason ? disabledReason : title}
  >
    {processing && <span className="adminButtonSpinner" aria-hidden="true" />}
    {processing && busyLabel !== undefined ? busyLabel : children}
  </button>;
}
