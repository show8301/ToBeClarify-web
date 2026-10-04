import { useEffect } from 'react';
import { AdminRoomServiceCreateForm } from '@/features/admin/rooms/AdminRoomServiceCreateForm.jsx';

export function AdminCreateRoomServiceDrawer({ businessDate, onClose, onCreated }) {
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

  return <div className="adminOrderPassDrawer" role="dialog" aria-modal="true" aria-label="建立包廂服務">
    <button type="button" className="adminOrderPassDrawerBackdrop" aria-label="關閉包廂服務建立視窗" onClick={onClose} />
    <aside className="adminOrderPassDrawerPanel">
      <div className="adminOrderInlinePanel adminRoomServiceDrawerPanel">
        <header>
          <div><span>ROOM SERVICE</span><h2>建立包廂服務</h2><p>在工作台直接建立時段，完成後會更新今日包廂服務排程。</p></div>
          <button type="button" aria-label="關閉包廂服務建立視窗" onClick={onClose}>×</button>
        </header>
        <AdminRoomServiceCreateForm date={businessDate} onCreated={onCreated} />
      </div>
    </aside>
  </div>;
}
