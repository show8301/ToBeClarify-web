"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";

export function StaffingAvailabilityHint({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger
      className="iconActionButton staffingAvailabilityTrigger"
      aria-label="查看臨時排班輸入狀態說明"
      openOnHover
      delay={150}
      closeDelay={150}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setOpen(true); }}
    ><Info aria-hidden="true" /></Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner side="bottom" align="start" sideOffset={8} className="staffingAvailabilityPositioner">
        <Popover.Popup className="adminTheme staffingAvailabilityPopup" initialFocus={false} finalFocus={false}>
          <Popover.Title>臨時排班輸入說明</Popover.Title>
          <Popover.Description>{reason}</Popover.Description>
          <Popover.Close className="staffingAvailabilityClose" aria-label="關閉臨時排班說明">關閉</Popover.Close>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
