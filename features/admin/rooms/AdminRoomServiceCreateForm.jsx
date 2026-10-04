import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/features/admin/api/client.js';
import { AdminButton } from '@/features/admin/shared/AdminShared.jsx';

const money = (value) => `${Number(value || 0).toLocaleString('zh-TW')} G`;

function errorMessage(error) {
  return error instanceof Error ? error.message : '包廂服務資料處理失敗。';
}

function formatPreview(value) {
  if (!value || Number.isNaN(value.getTime())) return '—';
  return value.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function AdminRoomServiceCreateForm({
  date,
  onDateChange,
  showDate = false,
  onCreated,
  submitLabel = '建立包廂服務',
}) {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ roomId: '', startsAt: `${date}T20:00`, segmentCount: 1, note: '' });
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoadingRooms(true);
    setError('');
    adminApi.getRooms(controller.signal).then((roomData) => {
      const nextRooms = Array.isArray(roomData) ? roomData : [];
      const activeRooms = nextRooms.filter((room) => room?.isActive);
      setRooms(nextRooms);
      setForm((current) => ({
        ...current,
        roomId: activeRooms.some((room) => room.id === current.roomId) ? current.roomId : activeRooms[0]?.id || '',
        startsAt: current.startsAt.startsWith(date) ? current.startsAt : `${date}T20:00`,
      }));
    }).catch((reason) => {
      if (reason?.name !== 'AbortError') setError(errorMessage(reason));
    }).finally(() => setLoadingRooms(false));
    return () => controller.abort();
  }, [date]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      startsAt: current.startsAt.startsWith(date) ? current.startsAt : `${date}T20:00`,
    }));
  }, [date]);

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === form.roomId), [form.roomId, rooms]);
  const segmentMinutes = Number(selectedRoom?.segmentMinutes || 0);
  const startsAt = form.startsAt ? new Date(form.startsAt) : null;
  const endsAt = startsAt && segmentMinutes > 0
    ? new Date(startsAt.getTime() + segmentMinutes * Number(form.segmentCount || 1) * 60 * 1000)
    : null;
  const totalAmount = Number(selectedRoom?.segmentPrice || 0) * Number(form.segmentCount || 0);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await adminApi.createRoomOrder({
        roomId: form.roomId,
        businessDate: date,
        startsAt: form.startsAt,
        segmentCount: Number(form.segmentCount),
        note: form.note.trim() || null,
      });
      setForm((current) => ({ ...current, note: '' }));
      await onCreated?.(created);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return <form className="adminRoomServiceForm" onSubmit={submit}>
    {showDate ? <label>營業日<input type="date" value={date} onChange={(event) => onDateChange?.(event.target.value)} required /></label> : null}
    <label>選擇包廂<select value={form.roomId} onChange={(event) => update('roomId', event.target.value)} required disabled={loadingRooms}><option value="">{loadingRooms ? '載入包廂中…' : '請選擇'}</option>{rooms.filter((room) => room.isActive).map((room) => <option key={room.id} value={room.id}>{room.roomName} · {money(room.segmentPrice)}／節</option>)}</select></label>
    <label>節數<input type="number" min="1" max="72" value={form.segmentCount} onChange={(event) => update('segmentCount', Number(event.target.value) || 1)} required /></label>
    <label>開始時間<input type="datetime-local" value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} required /></label>
    <label>現場備註<input value={form.note} maxLength="500" onChange={(event) => update('note', event.target.value)} placeholder="選填" /></label>
    <div className="adminRoomServicePreview" aria-live="polite">
      <span>預估結束 <strong>{formatPreview(endsAt)}</strong></span>
      <span>預估金額 <strong>{money(totalAmount)}</strong></span>
      {selectedRoom?.segmentMinutes ? <small>每節 {selectedRoom.segmentMinutes} 分鐘</small> : null}
    </div>
    {error ? <p className="adminFormError" role="alert">{error}</p> : null}
    <AdminButton type="submit" disabled={saving || loadingRooms || !form.roomId}>{saving ? '建立中…' : submitLabel}</AdminButton>
  </form>;
}
