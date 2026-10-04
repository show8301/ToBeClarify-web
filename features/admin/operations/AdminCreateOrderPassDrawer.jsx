import { useEffect } from 'react';
import { CreateSessionPanel, IssuedPanel } from '@/features/admin/orders/AdminOrderPassPanels.jsx';

export function AdminCreateOrderPassDrawer({ canManage, issued, onClose, onIssued }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return <div className="adminOrderPassDrawer" role="dialog" aria-modal="true" aria-label={issued ? '點餐資料已建立' : '發點餐碼'}>
    <button type="button" className="adminOrderPassDrawerBackdrop" aria-label="關閉發點餐碼" onClick={onClose} />
    <aside className="adminOrderPassDrawerPanel">
      {issued ? <IssuedPanel issued={issued} onClose={onClose} /> : <CreateSessionPanel canManage={canManage} onClose={onClose} onIssued={onIssued} />}
    </aside>
  </div>;
}
