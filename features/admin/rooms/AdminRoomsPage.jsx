import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/features/admin/api/client.js';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext.jsx';
import { useAdminImageProcessing } from '@/features/admin/media/AdminImageProcessingContext.js';
import { AdminButton, AdminDialog, AdminField, AdminPage, AdminPanel, AdminState, AdminToggle } from '@/features/admin/shared/AdminShared.jsx';

const emptyForm = () => ({ id: '', roomName: '', shortDescription: '', detailContent: '', ownerStaffId: '', segmentPrice: '', segmentMinutes: 20, sortOrder: 0, isActive: true, photos: [] });
const money = (value) => Number(value || 0) > 0 ? `${Number(value).toLocaleString('zh-TW')} G / 節` : '尚未定價';
const ownership = (room) => room.ownershipType === 'dedicated' ? `店員專屬 · ${room.ownerStaffName || '指定店員'}` : '店內共用';

function formFromRoom(room) {
  if (!room) return emptyForm();
  return {
    id: room.id,
    roomName: room.roomName || '',
    shortDescription: room.shortDescription || '',
    detailContent: room.detailContent || '',
    ownerStaffId: room.ownerStaffId || '',
    segmentPrice: room.segmentPrice || '',
    segmentMinutes: room.segmentMinutes || 20,
    sortOrder: room.sortOrder || 0,
    isActive: room.isActive !== false,
    photos: room.photos || [],
  };
}

export function AdminRoomsPage() {
  const { user } = useAdminAuth();
  const { processImage } = useAdminImageProcessing();
  const canManageSettings = user.role === 'developer' || user.role === 'manager';
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [profit, setProfit] = useState({ commonRoomStaffPercentage: 0, dedicatedRoomStaffPercentage: 100 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });

  const load = async (preferredId = '') => {
    setLoading(true);
    try {
      const values = await Promise.all([
        adminApi.getRooms(),
        adminApi.getStaffMembers(),
        canManageSettings ? adminApi.getRoomProfitSharing() : Promise.resolve(null),
      ]);
      const nextRooms = values[0] || [];
      setRooms(nextRooms);
      setStaff(values[1] || []);
      if (values[2]) setProfit(values[2]);
      const next = nextRooms.find((room) => room.id === (preferredId || form.id)) || nextRooms[0];
      setForm(formFromRoom(next));
      setMessage({ text: '', error: false });
    } catch (error) {
      setMessage({ text: error.message, error: true });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectRoom = (room) => { setForm(formFromRoom(room)); setMessage({ text: '', error: false }); };
  const startNew = () => { setForm(emptyForm()); setMessage({ text: '', error: false }); };

  const deleteRoom = async () => {
    if (!form.id || !canManageSettings) return;
    setDeleting(true);
    const deletedRoomName = form.roomName;
    try {
      await adminApi.deleteRoom(form.id);
      setDeleteConfirmOpen(false);
      await load();
      setMessage({ text: `包廂「${deletedRoomName || '未命名包廂'}」已刪除。`, error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setDeleting(false); }
  };

  const save = async () => {
    if (!form.roomName.trim() || !form.shortDescription.trim()) {
      setMessage({ text: '請先填寫包廂名稱與簡介。', error: true });
      return;
    }
    setSaving(true);
    try {
      const saved = await adminApi.saveRoom(form.id, {
        roomName: form.roomName.trim(),
        shortDescription: form.shortDescription.trim(),
        detailContent: form.detailContent.trim() || null,
        ownerStaffId: canManageSettings ? (form.ownerStaffId || null) : null,
        segmentPrice: canManageSettings && form.segmentPrice !== '' ? Number(form.segmentPrice) : null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        photos: form.photos.map((photo, index) => ({ id: photo.id, mediaId: photo.mediaId, sortOrder: index })),
      });
      setForm(formFromRoom(saved));
      setMessage({ text: '包廂資料已儲存。', error: false });
      await load(saved.id);
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setSaving(false); }
  };

  const uploadPhotos = async (files) => {
    if (!files.length) return;
    setUploading(true);
    setMessage({ text: '', error: false });
    try {
      const uploaded = [];
      for (const file of files.slice(0, 20 - form.photos.length)) {
        const processed = await processImage({ file, output: { maxWidth: 1800, maxHeight: 1200, quality: 0.82 } });
        const result = await adminApi.uploadMedia(processed, 'room');
        uploaded.push({ id: result.id, mediaId: result.id, imageUrl: result.url || result.imageUrl || '', sortOrder: form.photos.length + uploaded.length });
      }
      setForm((current) => ({ ...current, photos: [...current.photos, ...uploaded] }));
      setMessage({ text: `已加入 ${uploaded.length} 張包廂照片，儲存後正式套用。`, error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setUploading(false); }
  };

  const removePhoto = (id) => setForm((current) => ({ ...current, photos: current.photos.filter((photo) => photo.id !== id) }));
  const saveProfit = async () => {
    try {
      const value = await adminApi.saveRoomProfitSharing({
        commonRoomStaffPercentage: Number(profit.commonRoomStaffPercentage),
        dedicatedRoomStaffPercentage: Number(profit.dedicatedRoomStaffPercentage),
      });
      setProfit(value);
      setMessage({ text: '包廂分成設定已更新。', error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
  };

  const activeCount = useMemo(() => rooms.filter((room) => room.isActive).length, [rooms]);

  return <AdminPage eyebrow="ROOM CONTENT" title="包廂內容管理" description="管理公開包廂介紹、照片與內容。營業期間的預約與服務狀態請至包廂服務排程；價格、包廂歸屬與刪除僅開發者／經理可調整。" actions={<><AdminButton variant="secondary" disabled={loading || deleting} onClick={() => load(form.id)}>重新整理</AdminButton><AdminButton onClick={startNew}>＋ 新增包廂</AdminButton></>}>
    {message.text ? <div className={message.error ? 'adminRoomMessage isError' : 'adminRoomMessage'} role="status">{message.text}</div> : null}
    <AdminState loading={loading} error={null} />
    <div className="adminRoomLayout">
      <AdminPanel className="adminRoomListPanel" title={`包廂清單 · ${activeCount} 間啟用`} description="選擇一間包廂編輯；拖曳排序會在後續版本加入。">
        <div className="adminRoomList">{rooms.map((room, index) => <button type="button" key={room.id} className={room.id === form.id ? 'isActive' : ''} onClick={() => selectRoom(room)}><span className="adminRoomListPhoto">{room.photos?.[0]?.imageUrl ? <img src={room.photos[0].imageUrl} alt="" /> : <b>LD</b>}</span><span><strong>{room.roomName}</strong><small>{ownership(room)}</small><em className={room.isActive ? 'isActive' : ''}>{room.isActive ? '公開中' : '已停用'} · {money(room.segmentPrice)}</em></span><i>{String(index + 1).padStart(2, '0')}</i></button>)}</div>
        {!rooms.length && !loading ? <p className="adminEmptyText">尚未建立包廂，從右側開始新增。</p> : null}
      </AdminPanel>

      <AdminPanel className="adminRoomEditorPanel" title={form.id ? `編輯 · ${form.roomName || '未命名包廂'}` : '新增包廂'} description="包廂照片會使用公開網站的主視覺相框與左右切換樣式。">
        <div className="adminFormGrid adminRoomFormGrid">
          <AdminField label="包廂名稱" required><input value={form.roomName} maxLength={100} onChange={(event) => update('roomName', event.target.value)} placeholder="例如：海霧水庭" /></AdminField>
          <AdminField label="顯示排序"><input type="number" min="0" value={form.sortOrder} onChange={(event) => update('sortOrder', event.target.value)} /></AdminField>
          <AdminField label="包廂簡介" className="span-2" required><textarea rows="3" value={form.shortDescription} maxLength={500} onChange={(event) => update('shortDescription', event.target.value)} placeholder="用一兩句話介紹這個包廂適合的相遇。" /></AdminField>
          <AdminField label="詳細說明（非必填）" className="span-2"><textarea rows="5" value={form.detailContent} onChange={(event) => update('detailContent', event.target.value)} placeholder="可補充使用提醒、適合人數或入席說明。" /></AdminField>
          <AdminField label={`每節價格${form.segmentMinutes ? `（${form.segmentMinutes} 分鐘）` : ''}`} hint={canManageSettings ? '此欄位只有開發者／經理可修改。' : '店員可編輯包廂內容，但不能修改價格。'}><input type="number" min="0" disabled={!canManageSettings} value={form.segmentPrice} onChange={(event) => update('segmentPrice', event.target.value)} placeholder="請由經理設定" /></AdminField>
          <AdminField label="包廂歸屬" hint={canManageSettings ? '不指定店員即為店內共用包廂。' : '店員不可修改包廂歸屬。'}><select disabled={!canManageSettings} value={form.ownerStaffId} onChange={(event) => update('ownerStaffId', event.target.value)}><option value="">店內共用</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></AdminField>
          <div className="adminRoomActiveField"><AdminToggle checked={form.isActive} onChange={(value) => update('isActive', value)} label="公開這間包廂" /></div>
        </div>

        <div className="adminRoomPhotos"><header><div><h3>包廂照片</h3><p>最多 20 張；建議使用橫幅空間照，首張作為清單封面。</p></div><label className={`adminButton adminButton-secondary${uploading ? ' isDisabled' : ''}`}>{uploading ? '上傳處理中…' : '＋ 加入照片'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || form.photos.length >= 20} onChange={(event) => { void uploadPhotos([...event.target.files]); event.target.value = ''; }} /></label></header><div className="adminRoomPhotoGrid">{form.photos.map((photo, index) => <figure key={photo.id || photo.mediaId}><img src={photo.imageUrl || `/api/admin-media/${encodeURIComponent(photo.mediaId)}`} alt={`包廂照片 ${index + 1}`} /><figcaption><span>{index === 0 ? '封面' : `照片 ${index + 1}`}</span><button type="button" onClick={() => removePhoto(photo.id)}>移除</button></figcaption></figure>)}{!form.photos.length ? <p className="adminEmptyText">尚無照片，加入後會在這裡預覽。</p> : null}</div></div>
        <div className="adminRoomEditorActions">{form.id && canManageSettings ? <><AdminButton className="adminRoomDeleteButton" variant="danger" disabled={saving || uploading || deleting} onClick={() => setDeleteConfirmOpen(true)}>刪除包廂</AdminButton><span className="adminDialogActionSpacer" aria-hidden="true" /></> : null}<AdminButton variant="ghost" disabled={deleting} onClick={startNew}>清空表單</AdminButton><AdminButton disabled={saving || uploading || deleting} onClick={save}>{saving ? '儲存中…' : '儲存包廂資料'}</AdminButton></div>
      </AdminPanel>
    </div>

    {canManageSettings ? <AdminPanel className="adminRoomProfitPanel" title="包廂分成設定" description="薪資計算使用包廂訂單送出時的房型快照。店內共用與店員專屬分開設定，比例為包廂金額給店員的百分比。"><div className="adminRoomProfitGrid"><AdminField label="店內共用包廂 · 店員分成"><input type="number" min="0" max="100" value={profit.commonRoomStaffPercentage} onChange={(event) => setProfit({ ...profit, commonRoomStaffPercentage: event.target.value })} /><small>例如 30 代表店員取得包廂金額的 30%。</small></AdminField><AdminField label="店員專屬包廂 · 店員分成"><input type="number" min="0" max="100" value={profit.dedicatedRoomStaffPercentage} onChange={(event) => setProfit({ ...profit, dedicatedRoomStaffPercentage: event.target.value })} /><small>專屬包廂依所屬店員規則計算。</small></AdminField><AdminButton onClick={saveProfit}>儲存分成</AdminButton></div></AdminPanel> : null}
      <AdminDialog
        className="adminDeleteConfirmDialog"
        open={deleteConfirmOpen}
        title="確定刪除包廂？"
        description="此操作無法復原；排程中或服務中的服務訂單會阻止刪除。"
        onClose={() => { if (!deleting) setDeleteConfirmOpen(false); }}
        actions={<><AdminButton variant="ghost" autoFocus disabled={deleting} onClick={() => setDeleteConfirmOpen(false)}>取消</AdminButton><AdminButton variant="danger" disabled={deleting} onClick={deleteRoom}>{deleting ? '刪除中…' : `確認刪除「${form.roomName || '未命名包廂'}」`}</AdminButton></>}
      >
        <div className="adminDeleteConfirmContent">
          <span aria-hidden="true">!</span>
          <div><strong>{form.roomName || '未命名包廂'}</strong><p>刪除後會移除公開包廂資料與照片關聯；既有服務紀錄仍會保留歷史名稱與價格快照。</p></div>
        </div>
      </AdminDialog>
  </AdminPage>;
}
