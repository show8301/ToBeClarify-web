"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CircleAlert } from "lucide-react";

type Props = { title: string; children: string };

export function AdminHelp({ title, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="iconActionButton adminHelpTrigger"
        aria-label={title}
        openOnHover
        delay={150}
        closeDelay={150}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
      >
        <CircleAlert aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="adminHelpPositioner">
          <Popover.Popup className="adminTheme adminHelpPopup" initialFocus={false} finalFocus={false}>
            <Popover.Title>{title}</Popover.Title>
            <Popover.Description>{children}</Popover.Description>
            <Popover.Close aria-label={`關閉${title}`}>關閉</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
