"use client";

import { InlineHelp } from "@/components/InlineHelp";

type Props = { title: string; children: string };

export function AdminHelp({ title, children }: Props) {
  return (
    <InlineHelp
      title={title}
      triggerClassName="adminHelpTrigger"
      positionerClassName="adminHelpPositioner"
      popupClassName="adminTheme adminHelpPopup"
    >
      {children}
    </InlineHelp>
  );
}
