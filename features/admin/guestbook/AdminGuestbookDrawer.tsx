import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  children: ReactNode;
  onClose: () => void;
};

export function AdminGuestbookDrawer({ open, title, description, busy = false, children, onClose }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }}>
      {/* Keep the form mounted so closing the drawer preserves its attachment draft. */}
      <Dialog.Portal keepMounted>
        <div className="adminTheme adminGuestbookDrawerTheme">
          <Dialog.Backdrop className="adminGuestbookDrawerBackdrop" />
          <Dialog.Popup className="adminGuestbookDrawer">
            <header className="adminGuestbookDrawerHeader">
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                {description ? <Dialog.Description>{description}</Dialog.Description> : null}
              </div>
              <Dialog.Close className="adminButton adminButton-ghost iconActionButton" disabled={busy} aria-label={`關閉${title}`} title="關閉">
                <X aria-hidden="true" />
              </Dialog.Close>
            </header>
            <div className="adminGuestbookDrawerBody">{children}</div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
