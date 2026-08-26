import { useEffect, useState } from 'react';
import { adminApi } from './admin-api.js';
import {
  AdminButton, AdminDialog, AdminDragList, AdminField, AdminImagePicker, AdminPage, AdminPanel, AdminState,
  AdminToggle, newId, splitParagraphs, toDateTimeLocal,
} from './AdminShared.jsx';

const emptyReport = {
  id: '', albumTitle: '', albumDescription: '', coverMediaId: null, coverImageUrl: '', coverFile: null,
  periodText: '', endsAt: '', detailText: '', items: [], sortOrder: 0, isPublished: false,
};

function readDetails(value) {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join('\n\n') : String(value);
  } catch {
    return String(value);
  }
}

function toEditor(report) {
  return {
    ...emptyReport,
    ...report,
    endsAt: toDateTimeLocal(report.endsAt),
    detailText: readDetails(report.detailContent),
    coverFile: null,
    items: (report.items || []).map((item) => ({ ...item, _file: null })),
  };
}

function reportRequest(report, coverMediaId = report.coverMediaId, coverImageUrl = report.coverImageUrl, items = report.items) {
  return {
    albumTitle: report.albumTitle,
    albumDescription: report.albumDescription || null,
    coverMediaId: coverMediaId || null,
    coverImageUrl: coverImageUrl || null,
    periodText: report.periodText || null,
    endsAt: report.endsAt || null,
    detailContent: JSON.stringify(splitParagraphs(report.detailText)),
    items: (items || []).map((item, index) => ({
      id: item.id?.startsWith('local-') ? null : item.id,
      mediaId: item.mediaId || null,
      imageUrl: item.imageUrl || null,
      thumbnailUrl: item.thumbnailUrl || null,
      title: item.title || null,
      caption: item.caption || null,
      shotAt: item.shotAt || null,
      sortOrder: Number(item.sortOrder ?? index) || 0,
      isPublished: item.isPublished,
    })),
    sortOrder: Number(report.sortOrder) || 0,
    isPublished: report.isPublished,
  };
}

export function AdminEventsPage() {
  const [reports, setReports] = useState([]);
  const [editingReport, setEditingReport] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });
  const [saving, setSaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setState({ loading: true, error: null });
    try {
      const items = await adminApi.getGalleryAlbums();
      setReports(items);
      setOrderDirty(false);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  useEffect(() => { load(); }, []);

  const saveEditor = async () => {
    if (!editingReport) return;
    setSaving(true);
    setMessage('');
    try {
      let coverMediaId = editingReport.coverMediaId || null;
      let coverImageUrl = editingReport.coverImageUrl || null;
      if (editingReport.coverFile) {
        const uploaded = await adminApi.uploadMedia(editingReport.coverFile, 'gallery');
        coverMediaId = uploaded.id;
        coverImageUrl = uploaded.url;
      }
      const items = [];
      for (const item of editingReport.items || []) {
        let mediaId = item.mediaId || null;
        let imageUrl = item.imageUrl || null;
        if (item._file) {
          const uploaded = await adminApi.uploadMedia(item._file, 'gallery');
          mediaId = uploaded.id;
          imageUrl = uploaded.url;
        }
        items.push({ ...item, mediaId, imageUrl });
      }
      const saved = await adminApi.saveGalleryAlbum(
        editingReport.id.startsWith('local-') ? null : editingReport.id || null,
        reportRequest(editingReport, coverMediaId, coverImageUrl, items),
      );
      setReports((current) => current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setEditingReport(null);
      setEditingItem(null);
      setMessage('週報已儲存。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveOrder = async () => {
    if (!orderDirty) return;
    setOrderSaving(true);
    try {
      for (const report of reports.filter((item) => !item.id.startsWith('local-'))) {
        await adminApi.saveGalleryAlbum(report.id, reportRequest(report));
      }
      setOrderDirty(false);
      setMessage('週報順序已儲存。');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setOrderSaving(false);
    }
  };

  const createReport = () => {
    const item = { ...emptyReport, id: newId(), sortOrder: reports.length };
    setReports((current) => [...current, item]);
    setEditingReport(item);
    setMessage('');
  };

  const addImage = () => {
    const item = { id: newId(), mediaId: null, imageUrl: '', thumbnailUrl: '', title: '', caption: '', shotAt: '', sortOrder: editingReport?.items?.length || 0, isPublished: true, _file: null };
    setEditingReport((current) => ({ ...current, items: [...(current.items || []), item] }));
    setEditingItem(item);
  };

  const saveItemEditor = () => {
    setEditingReport((current) => ({ ...current, items: (current.items || []).map((item) => item.id === editingItem.id ? editingItem : item) }));
    setEditingItem(null);
  };

  const remove = async () => {
    if (!editingReport?.id || !window.confirm(`確定刪除「${editingReport.albumTitle}」？`)) return;
    try {
      if (!editingReport.id.startsWith('local-')) await adminApi.deleteGalleryAlbum(editingReport.id);
      setReports((current) => current.filter((item) => item.id !== editingReport.id).map((item, index) => ({ ...item, sortOrder: index })));
      setEditingReport(null);
      setMessage('週報已刪除。');
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <AdminPage eyebrow="Eorzea Weekly" title="活動設定" description="維護艾歐澤亞週報、封面與內頁圖片。首頁輪播會從這裡選擇週報；拖曳卡片調整順序，點擊卡片開啟編輯。" actions={<><AdminButton variant="secondary" onClick={createReport}>新增週報</AdminButton><AdminButton onClick={saveOrder} disabled={!orderDirty || orderSaving}>{orderSaving ? '儲存中…' : '儲存週報順序'}</AdminButton></>}>
      {message ? <div className="adminNotice">{message}</div> : null}
      <AdminState loading={state.loading} error={state.error} onRetry={load} />
      {!state.loading && !state.error ? <AdminPanel title="週報列表" description="公開的週報會同時顯示於艾歐澤亞週報頁與首頁輪播選擇器。">
        <AdminDragList items={reports} onReorder={(items) => { setReports(items); setOrderDirty(true); }} onItemClick={(item) => setEditingReport(toEditor(item))} renderItem={(report) => <><div className="adminDragCardWithImage">{report.coverImageUrl ? <img src={report.coverImageUrl} alt="" /> : null}<div><strong>{report.albumTitle || '未命名週報'}</strong><small>{report.periodText || '未設定期間'} · 內頁圖片 {(report.items || []).length} 張</small></div></div><div className="adminDragCardMeta"><em>{report.isPublished ? '公開' : '草稿'}</em></div></>} emptyText="尚無週報，請新增第一筆週報。" />
      </AdminPanel> : null}

      <AdminDialog open={Boolean(editingReport)} title={editingReport?.id?.startsWith('local-') ? '新增週報' : `編輯週報：${editingReport?.albumTitle || '未命名'}`} description="排序請回到週報卡片清單拖曳調整；圖片選擇後先預覽，儲存週報時才上傳。" onClose={() => setEditingReport(null)} actions={<><AdminButton variant="danger" onClick={remove}>刪除週報</AdminButton><span className="adminDialogActionSpacer" /><AdminButton variant="ghost" onClick={() => setEditingReport(null)}>取消</AdminButton><AdminButton onClick={saveEditor} disabled={saving}>{saving ? '儲存中…' : '儲存週報'}</AdminButton></>}>
        {editingReport ? <>
          <div className="adminFormGrid"><AdminField label="週報標題" className="span-2"><input value={editingReport.albumTitle} onChange={(event) => setEditingReport((current) => ({ ...current, albumTitle: event.target.value }))} autoFocus /></AdminField><AdminField label="摘要" className="span-2"><textarea rows="3" value={editingReport.albumDescription || ''} onChange={(event) => setEditingReport((current) => ({ ...current, albumDescription: event.target.value }))} /></AdminField><AdminField label="期間文字"><input value={editingReport.periodText || ''} onChange={(event) => setEditingReport((current) => ({ ...current, periodText: event.target.value }))} /></AdminField><AdminField label="結束時間"><input type="datetime-local" value={editingReport.endsAt || ''} onChange={(event) => setEditingReport((current) => ({ ...current, endsAt: event.target.value }))} /></AdminField><AdminField label="詳細內容（段落之間空一行）" className="span-2"><textarea rows="8" value={editingReport.detailText || ''} onChange={(event) => setEditingReport((current) => ({ ...current, detailText: event.target.value }))} /></AdminField><AdminImagePicker label="週報封面" value={editingReport.coverImageUrl} pendingFile={editingReport.coverFile} onChange={(file) => setEditingReport((current) => ({ ...current, coverFile: file }))} onClear={() => setEditingReport((current) => ({ ...current, coverFile: null, coverImageUrl: '', coverMediaId: null }))} /><div className="adminFormWide"><AdminToggle checked={editingReport.isPublished} onChange={(value) => setEditingReport((current) => ({ ...current, isPublished: value }))} label="公開顯示" /></div></div>
          <AdminPanel title="週報內頁圖片" description="這些圖片會顯示在週報頁與首頁輪播點開後的同一個 Dialog。拖曳調整順序。" actions={<AdminButton variant="secondary" onClick={addImage}>新增內頁圖片</AdminButton>}>
            <AdminDragList items={editingReport.items || []} onReorder={(items) => setEditingReport((current) => ({ ...current, items }))} onItemClick={(item) => setEditingItem({ ...item })} renderItem={(item) => <><div className="adminDragCardWithImage">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<div><strong>{item.title || (item.imageUrl ? '週報內頁圖片' : '尚未選擇圖片')}</strong><small>{item.isPublished ? '公開' : '隱藏'} · 儲存週報時上傳</small></div></div><div className="adminDragCardMeta"><AdminButton variant="danger" onClick={(event) => { event.stopPropagation(); setEditingReport((current) => ({ ...current, items: (current.items || []).filter((image) => image.id !== item.id) })); }}>移除</AdminButton></div></>} emptyText="尚無內頁圖片。" />
          </AdminPanel>
        </> : null}
      </AdminDialog>

      <AdminDialog open={Boolean(editingItem)} title="編輯週報內頁圖片" description="選擇圖片後先預覽，儲存週報時才會上傳到伺服器。" onClose={() => setEditingItem(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingItem(null)}>取消</AdminButton><AdminButton onClick={saveItemEditor}>完成編輯</AdminButton></>}>
        {editingItem ? <div className="adminFormGrid"><AdminImagePicker label="內頁圖片" value={editingItem.imageUrl} pendingFile={editingItem._file} onChange={(file) => setEditingItem((current) => ({ ...current, _file: file }))} onClear={() => setEditingItem((current) => ({ ...current, _file: null, imageUrl: '', mediaId: null }))} /><AdminField label="圖片標題"><input value={editingItem.title || ''} onChange={(event) => setEditingItem((current) => ({ ...current, title: event.target.value }))} /></AdminField><AdminField label="圖片說明" className="span-2"><textarea rows="4" value={editingItem.caption || ''} onChange={(event) => setEditingItem((current) => ({ ...current, caption: event.target.value }))} /></AdminField><div className="adminFormWide"><AdminToggle checked={editingItem.isPublished} onChange={(value) => setEditingItem((current) => ({ ...current, isPublished: value }))} label="公開顯示" /></div></div> : null}
      </AdminDialog>
    </AdminPage>
  );
}
