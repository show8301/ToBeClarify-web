"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CircleAlert } from "lucide-react";

type Props = {
  title: string;
  children: string;
  triggerClassName?: string;
  positionerClassName?: string;
  popupClassName?: string;
};

export function InlineHelp({
  title,
  children,
  triggerClassName = "inlineHelpTrigger",
  positionerClassName = "inlineHelpPositioner",
  popupClassName = "inlineHelpPopup",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        className={`iconActionButton ${triggerClassName}`}
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
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className={positionerClassName}>
          <Popover.Popup className={popupClassName} initialFocus={false} finalFocus={false}>
            <Popover.Title>{title}</Popover.Title>
            <Popover.Description>{children}</Popover.Description>
            <Popover.Close aria-label={`關閉${title}`}>關閉</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
