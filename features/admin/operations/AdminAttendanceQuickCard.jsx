import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/features/admin/api/client.js';
import { AdminButton, AdminPanel } from '@/features/admin/shared/AdminShared.jsx';

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : '出勤操作失敗，請稍後再試。';
}

export function AdminAttendanceQuickCard({ businessDate, staffMemberId = '' }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', tone: '' });

  const load = useCallback(async () => {
    if (!businessDate) return;
    setLoading(true);
    try {
      const overview = await adminApi.getAttendance(businessDate);
      const rows = Array.isArray(overview?.staff) ? overview.staff : [];
      setSummary(rows.find((row) => row.staffId === staffMemberId) || null);
    } catch (error) {
      setMessage({ text: errorMessage(error), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [businessDate, staffMemberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async () => {
    if (!summary || busy) return;
    const action = summary.hasOpenShift ? 'clock_out' : 'clock_in';
    setBusy(true);
    setMessage({ text: '', tone: '' });
    try {
      await adminApi.applyAttendance({
        operationId: crypto.randomUUID(),
        businessDate,
        staffId: staffMemberId || undefined,
        action,
      });
      setMessage({ text: action === 'clock_in' ? '上班打卡成功。' : '下班打卡成功。', tone: 'success' });
      await load();
    } catch (error) {
      await load();
      if (error?.status === 409 || error?.code === 'ATTENDANCE_NO_OPEN_SHIFT') {
        setMessage({ text: '打卡狀態已在其他分頁更新，已重新整理目前狀態。', tone: 'info' });
      } else {
        setMessage({ text: errorMessage(error), tone: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  return <AdminPanel className="adminAttendanceQuickCard" title="我的出勤" description="只記錄目前登入店員的當下上下班時間，不會自動轉單或切換接單狀態。">
    {loading ? <p className="adminRoleDashboardEmpty">讀取目前打卡狀態中…</p> : !staffMemberId ? <p className="adminRoleDashboardEmpty">目前帳號尚未綁定店員身分，無法使用個人打卡。</p> : !summary ? <p className="adminRoleDashboardEmpty">今天沒有可使用的核准班次。</p> : <>
      <div className="adminAttendanceQuickBody">
        <div className={`adminAttendanceQuickStatus${summary.hasOpenShift ? ' isWorking' : ''}`}>
          <span>{summary.hasOpenShift ? '目前上班中' : '尚未上班'}</span>
          <strong>{summary.hasOpenShift ? formatTime(summary.actualStart) : '—'}</strong>
          <small>有效工時 {summary.effectiveMinutes || 0} 分鐘{summary.activeServiceCount ? ` · 服務中 ${summary.activeServiceCount} 筆` : ''}</small>
        </div>
        <AdminButton variant={summary.hasOpenShift ? 'secondary' : 'primary'} onClick={() => void apply()} disabled={busy}>{busy ? '處理中…' : summary.hasOpenShift ? '下班打卡' : '上班打卡'}</AdminButton>
      </div>
      {message.text ? <p className={`adminAttendanceQuickMessage is${message.tone ? message.tone[0].toUpperCase() + message.tone.slice(1) : 'Info'}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
    </>}
  </AdminPanel>;
}
