import type { ComponentPropsWithoutRef } from "react";

export function AdminDisclosureSummary({ children, className = "", ...props }: ComponentPropsWithoutRef<"summary">) {
  return (
    <summary {...props} className={`adminDisclosureSummary ${className}`.trim()}>
      <span className="adminDisclosureLabel">{children}</span>
      <span className="adminDisclosureChevron" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </summary>
  );
}
