"use client";

import { useEffect, useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { CirclePlay, CircleStop, MoreVertical, Music2, Search, Trash2, Upload } from 'lucide-react';
import { AdminButton, AdminDialog, AdminField } from '@/features/admin/shared/AdminShared.jsx';
import { notificationRequest, notificationSoundUrl } from '@/features/admin/notifications/api';
import type { NotificationSound } from '@/features/admin/notifications/types';

type Props = {
  sounds: NotificationSound[];
  developer: boolean;
  busy: boolean;
  canUpload: boolean;
  setBusy: (value: boolean) => void;
  onSoundsChange: (updater: (sounds: NotificationSound[]) => NotificationSound[]) => void;
  onMessage: (message: string) => void;
};

function durationLabel(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function NotificationSoundLibrary({ sounds, developer, busy, canUpload, setBusy, onSoundsChange, onMessage }: Props) {
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [systemCode, setSystemCode] = useState('');
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [playingId, setPlayingId] = useState('');
  const player = useRef<HTMLAudioElement | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { player.current?.pause(); request.current?.abort(); }, []);

  const preview = async (sound: NotificationSound) => {
    player.current?.pause();
    player.current = null;
    if (playingId === sound.id) { setPlayingId(''); return; }
    const audio = new Audio(notificationSoundUrl(sound.id));
    player.current = audio;
    setPlayingId(sound.id); setError('');
    audio.onended = () => { if (player.current === audio) setPlayingId(''); };
    audio.onerror = () => { if (player.current === audio) { setPlayingId(''); setError(`無法播放「${sound.name}」，請稍後再試。`); } };
    try { await audio.play(); }
    catch { if (player.current === audio) { setPlayingId(''); setError(`無法播放「${sound.name}」，請稍後再試。`); } }
  };

  const upload = async () => {
    if (!file || busy) return;
    if (!/\.mp3$/i.test(file.name) || file.size <= 0 || file.size > 1048576) { setUploadError('請選擇最多 1 MiB 的 MP3 音檔。'); return; }
    if (!name.trim() || name.trim().length > 80) { setUploadError('請輸入 1–80 字的音效名稱。'); return; }
    if (systemCode && !/^[a-z][a-z0-9_]{0,59}$/.test(systemCode)) { setUploadError('系統音效代碼須以小寫英文字母開頭，只能使用小寫字母、數字與底線，最多 60 字。'); return; }
    setBusy(true); setUploadError('');
    const controller = new AbortController(); request.current = controller;
    const body = new FormData(); body.append('file', file); body.append('name', name.trim());
    if (developer && systemCode) body.append('systemCode', systemCode);
    try {
      const sound = await notificationRequest<NotificationSound>('/sounds', body, { signal: controller.signal });
      if (controller.signal.aborted) return;
      onSoundsChange(current => [...current, sound]);
      setFile(null); setName(''); setSystemCode(''); setQuery(''); setUploadOpen(false);
      onMessage('音效已上傳，可在規則中選用。');
    } catch (e) { if (!controller.signal.aborted) setUploadError(e instanceof Error ? e.message : '音效上傳失敗，請稍後再試。'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };

  const deleteSound = async (sound: NotificationSound) => {
    if (!sound.canDelete || busy || !window.confirm(`確定刪除「${sound.name}」？已被規則或待發送通知使用的音效無法刪除。`)) return;
    setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      await notificationRequest(`/sounds/${encodeURIComponent(sound.id)}`, {}, { method: 'DELETE', signal: controller.signal });
      if (controller.signal.aborted) return;
      if (playingId === sound.id) { player.current?.pause(); player.current = null; setPlayingId(''); }
      onSoundsChange(current => current.filter(item => item.id !== sound.id));
      onMessage(`音效「${sound.name}」已停用。`);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '音效刪除失敗。'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const filtered = sounds.filter(sound => sound.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <section className="notification-card notification-library" aria-labelledby="notification-library-title">
      <header className="notification-card-heading"><h2 id="notification-library-title">音效庫</h2><AdminButton disabled={busy || !canUpload} onClick={() => { setUploadError(''); setUploadOpen(true); }}><Upload size={18} aria-hidden="true" />上傳音效</AdminButton></header>
      <label className="notification-search"><Search size={18} aria-hidden="true" /><input aria-label="搜尋音效名稱" placeholder="搜尋音效名稱…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      {error && <p className="notification-library-error" role="alert">{error}</p>}
      {!canUpload && <p className="adminFieldHint">音效上傳目前尚未開放。</p>}
      <div className="notification-sound-table-wrap"><table className="notification-sound-table">
        <caption className="adminVisuallyHidden">音效清單，可試聽及管理已上傳的音效</caption>
        <thead><tr><th scope="col">音效名稱</th><th scope="col">時長</th><th scope="col">操作</th></tr></thead>
        <tbody>{filtered.map(sound => <tr key={sound.id}>
          <td><div className="notification-sound-name"><button type="button" className="notification-preview-button" aria-label={`${playingId === sound.id ? '停止' : '試聽'}「${sound.name}」`} onClick={() => void preview(sound)}>{playingId === sound.id ? <CircleStop size={23} aria-hidden="true" /> : <CirclePlay size={23} aria-hidden="true" />}</button><span>{sound.name}</span></div></td>
          <td><span title={`${sound.durationMs / 1000} 秒`}>{durationLabel(sound.durationMs)}</span></td>
          <td><Menu.Root><Menu.Trigger className="notification-icon-button" aria-label={`「${sound.name}」的更多操作`}><MoreVertical size={19} aria-hidden="true" /></Menu.Trigger><Menu.Portal><Menu.Positioner sideOffset={6} align="end" className="notification-menu-positioner"><Menu.Popup className="notification-action-menu" aria-label={`${sound.name}的操作`}>
            <Menu.Item onClick={() => void preview(sound)}><CirclePlay size={16} aria-hidden="true" />{playingId === sound.id ? '停止試聽' : '試聽音效'}</Menu.Item>
            {sound.canDelete ? <Menu.Item className="is-danger" disabled={busy} onClick={() => void deleteSound(sound)}><Trash2 size={16} aria-hidden="true" />刪除音效</Menu.Item> : <Menu.Item disabled>此音效無法刪除</Menu.Item>}
          </Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root></td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && <div className="notification-empty"><Music2 size={28} aria-hidden="true" /><strong>{sounds.length ? '找不到符合的音效' : '尚無可用音效'}</strong><p>{sounds.length ? '試著使用其他名稱搜尋。' : '上傳 MP3，為不同提醒設定專屬音效。'}</p></div>}
      <p className="notification-library-note">MP3・最多 5 秒／1 MiB。鈴鐺有聲波表示已設定音效。</p>
      <AdminDialog open={uploadOpen} title="上傳音效" description="選擇最多 5 秒、1 MiB 的 MP3 音檔。上傳後可在通知規則中選用。" onClose={() => { if (!busy) setUploadOpen(false); }} className="notification-upload-dialog" actions={<><AdminButton variant="ghost" disabled={busy} onClick={() => setUploadOpen(false)}>取消</AdminButton><AdminButton disabled={busy || !file || !name.trim() || !canUpload} onClick={upload}><Upload size={17} aria-hidden="true" />{busy ? '上傳中…' : '上傳音效'}</AdminButton></>}>
        <fieldset className="notification-upload-fields" disabled={busy}>
          <legend className="adminVisuallyHidden">音效檔案與名稱</legend>
          {uploadError && <p className="adminNotice" role="alert">{uploadError}</p>}
          <AdminField label="音效名稱" required><input value={name} maxLength={80} placeholder="例如：訂單提示音" onChange={event => setName(event.target.value)} /></AdminField>
          <AdminField label="MP3 音檔" required hint={file ? `已選取：${file.name}` : '僅接受 MP3，最多 5 秒／1 MiB。'}><input type="file" accept=".mp3,audio/mpeg" onChange={event => { const next = event.target.files?.[0] || null; setFile(next); setUploadError(''); if (next && !name.trim()) setName(next.name.replace(/\.mp3$/i, '').slice(0, 80)); }} /></AdminField>
          {developer && <AdminField label="系統音效代碼（留空為個人音效）" hint="基礎代碼：order_chime、time_reminder、store_broadcast；也可增加其他代碼。"><input value={systemCode} maxLength={60} pattern="[a-z][a-z0-9_]*" onChange={event => setSystemCode(event.target.value)} /></AdminField>}
        </fieldset>
      </AdminDialog>
    </section>
  );
}
