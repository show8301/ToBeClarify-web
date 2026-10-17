import { useEffect, useState } from 'react';
import { IssuedPanel } from '@/features/admin/orders/AdminOrderPassPanels.jsx';
import { CreateSessionPanel } from '@/features/admin/orders/CreateSessionPanel';

export function AdminCreateOrderPassDrawer({ canManage, issued, onClose, onIssued }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, busy]);

  return <div className="adminOrderPassDrawer" role="dialog" aria-modal="true" aria-label={issued ? '點餐資料已建立' : '發點餐碼'}>
    <button type="button" className="adminOrderPassDrawerBackdrop" aria-label="關閉發點餐碼" disabled={busy} onClick={onClose} />
    <aside className="adminOrderPassDrawerPanel">
      {issued ? <IssuedPanel issued={issued} onClose={onClose} /> : <CreateSessionPanel canManage={canManage} onClose={onClose} onBusyChange={setBusy} onIssued={(value) => { setBusy(false); onIssued(value); }} />}
    </aside>
  </div>;
}
