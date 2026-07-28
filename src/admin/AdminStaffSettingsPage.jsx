import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api/client.js';
import { useAdminAuth } from './AdminAuthContext.jsx';
import {
  AdminButton, AdminDialog, AdminDragList, AdminField, AdminImagePicker, AdminPage, AdminPanel, AdminState,
  AdminToggle, newId,
} from './AdminShared.jsx';

const emptyStaff = {
  id: '', displayName: '', nickname: '', avatarMediaId: null, avatarUrl: '', avatarFile: null,
  roleTitle: '', shortBio: '', profileBio: '', isWorkingToday: true,
  sortOrder: 0, isActive: true, services: [], gallery: [],
};

function toEditor(value) {
  return {
    ...emptyStaff,
    ...value,
    avatarFile: null,
    services: (value.services || []).map((item) => ({ ...item })),
    gallery: (value.gallery || []).map((item) => ({ ...item, _file: null })),
  };
}

export function AdminStaffSettingsPage() {
  const { user } = useAdminAuth();
  const [staffList, setStaffList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyStaff);
  const [editingService, setEditingService] = useState(null);
  const [editingGallery, setEditingGallery] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });
  const [saving, setSaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [staffOrderDirty, setStaffOrderDirty] = useState(false);
  const [message, setMessage] = useState('');
  const isClerk = user.role === 'clerk';
  const canManageAll = user.role === 'developer' || user.role === 'manager';

  const load = async () => {
    setState({ loading: true, error: null });
    try {
      const items = await adminApi.getStaffMembers();
      setStaffList(items);
      const nextId = selectedId && items.some((item) => item.id === selectedId) ? selectedId : items[0]?.id || '';
      setSelectedId(nextId);
      setForm(nextId ? toEditor(items.find((item) => item.id === nextId)) : emptyStaff);
      setStaffOrderDirty(false);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  useEffect(() => { load(); }, []);

  const selectedLabel = useMemo(() => staffList.find((item) => item.id === selectedId)?.displayName || '尚未選擇', [selectedId, staffList]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const selectStaff = (id) => {
    const next = staffList.find((item) => item.id === id);
    setSelectedId(id);
    setForm(next ? toEditor(next) : emptyStaff);
    setMessage('');
  };

  const reorderStaff = (items) => {
    setStaffList(items);
    setStaffOrderDirty(true);
  };

  const saveStaffOrder = async () => {
    if (!canManageAll || !staffOrderDirty) return;
    setOrderSaving(true);
    try {
      await adminApi.reorderStaffMembers(staffList.map((item, index) => ({ id: item.id, sortOrder: index })));
      setStaffOrderDirty(false);
      setMessage('店員順序已儲存。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setOrderSaving(false);
    }
  };

  const save = async () => {
    if (!form.id) return;
    setSaving(true);
    setMessage('');
    try {
      let avatarMediaId = form.avatarMediaId || null;
      let avatarUrl = form.avatarUrl || null;
      if (form.avatarFile) {
        const uploaded = await adminApi.uploadMedia(form.avatarFile, 'staff');
        avatarMediaId = uploaded.id;
        avatarUrl = uploaded.url;
      }
      const gallery = [];
      for (const item of form.gallery) {
        let mediaId = item.mediaId || null;
        let imageUrl = item.imageUrl || null;
        if (item._file) {
          const uploaded = await adminApi.uploadMedia(item._file, 'gallery');
          mediaId = uploaded.id;
          imageUrl = uploaded.url;
        }
        gallery.push({ id: item.id?.startsWith('local-') ? null : item.id, mediaId, imageUrl, sortOrder: Number(item.sortOrder) || 0, isPublished: item.isPublished });
      }
      const saved = await adminApi.saveStaffMember(form.id, {
        displayName: form.displayName, nickname: form.nickname || null, avatarMediaId, avatarUrl,
        roleTitle: form.roleTitle || null, shortBio: form.shortBio || null, profileBio: form.profileBio || null,
        isWorkingToday: form.isWorkingToday,
        sortOrder: canManageAll ? Number(form.sortOrder) || 0 : Number(staffList.find((item) => item.id === form.id)?.sortOrder) || 0,
        isActive: form.isActive,
        services: form.services.map((item) => ({
          id: item.id?.startsWith('local-') ? null : item.id, serviceType: item.serviceType,
          serviceName: item.serviceName, serviceDescription: item.serviceDescription, priceText: item.priceText || null,
          sortOrder: Number(item.sortOrder) || 0, isEnabled: item.isEnabled,
        })),
        gallery,
      });
      setForm(toEditor(saved));
      setStaffList((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage('店員資料已儲存。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteStaff = async () => {
    if (!canManageAll || !form.id || !window.confirm(`確定刪除 ${form.displayName}？`)) return;
    await adminApi.deleteStaffMember(form.id);
    setSelectedId('');
    await load();
  };

  const saveServiceEditor = () => {
    setForm((current) => ({ ...current, services: current.services.map((item) => item.id === editingService.id ? editingService : item) }));
    setEditingService(null);
  };
  const saveGalleryEditor = () => {
    setForm((current) => ({ ...current, gallery: current.gallery.map((item) => item.id === editingGallery.id ? editingGallery : item) }));
    setEditingGallery(null);
  };
  const reorderServices = (items) => update('services', items);
  const reorderGallery = (items) => update('gallery', items);

  return (
    <AdminPage eyebrow="Staff Directory" title="店員設定" description="先選擇要編輯的店員，再維護公開卡片、服務與相簿。排序統一使用拖曳卡片。" actions={<AdminButton onClick={save} disabled={saving || !form.id}>{saving ? '儲存中…' : '儲存店員資料'}</AdminButton>}>
      {message ? <div className="adminNotice">{message}</div> : null}
      <AdminState loading={state.loading} error={state.error} onRetry={load} />
      {!state.loading && !state.error ? <>
        <AdminPanel title="編輯對象" description={isClerk ? '店員帳號已鎖定為自己的資料。' : '經理與開發者可以在所有店員之間切換。'}>
          <div className="adminSelectorRow">
            <AdminField label="店員"><select value={selectedId} disabled={isClerk} onChange={(event) => selectStaff(event.target.value)}>{staffList.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.isActive ? '' : '（已停用）'}</option>)}</select></AdminField>
            <span className="adminSelectionHint">目前編輯：{selectedLabel}</span>
          </div>
        </AdminPanel>

        {canManageAll ? <AdminPanel title="店員公開順序" description="拖曳店員卡片調整公開列表順序；點擊卡片切換下方編輯對象。" actions={<AdminButton variant="secondary" onClick={saveStaffOrder} disabled={!staffOrderDirty || orderSaving}>{orderSaving ? '儲存中…' : '儲存店員順序'}</AdminButton>}>
          <AdminDragList items={staffList} onReorder={reorderStaff} onItemClick={(item) => selectStaff(item.id)} renderItem={(item) => <><div className="adminDragCardWithImage">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : null}<div><strong>{item.displayName}</strong><small>{item.roleTitle || '尚未設定角色'}</small></div></div><div className="adminDragCardMeta"><em>{item.isActive ? '公開' : '停用'}</em></div></>} emptyText="尚無店員資料。" /></AdminPanel> : null}

        {form.id ? <>
          <AdminPanel title="基本資料" description="公開店員頁與詳細 Dialog 會使用這些內容。" className="adminFormPanel">
            <div className="adminFormGrid">
              <AdminField label="顯示名稱"><input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} /></AdminField>
              <AdminField label="暱稱"><input value={form.nickname || ''} onChange={(event) => update('nickname', event.target.value)} /></AdminField>
              <AdminField label="角色標籤"><input value={form.roleTitle || ''} onChange={(event) => update('roleTitle', event.target.value)} /></AdminField>
              <AdminField label="卡片簡介" className="span-2"><textarea rows="3" value={form.shortBio || ''} onChange={(event) => update('shortBio', event.target.value)} /></AdminField>
              <AdminField label="詳細介紹" className="span-2"><textarea rows="7" value={form.profileBio || ''} onChange={(event) => update('profileBio', event.target.value)} /></AdminField>
              <div className="adminFormWide"><AdminToggle checked={form.isWorkingToday} onChange={(value) => update('isWorkingToday', value)} label="今天有上班" /></div>
              <AdminImagePicker label="頭像" value={form.avatarUrl} pendingFile={form.avatarFile} onChange={(file) => update('avatarFile', file)} onClear={() => { update('avatarFile', null); update('avatarUrl', ''); update('avatarMediaId', null); }} />
              <div className="adminFormWide"><AdminToggle checked={form.isActive} onChange={(value) => update('isActive', value)} label="顯示於公開店員列表" /></div>
            </div>
          </AdminPanel>

          <AdminPanel title="服務內容" description={canManageAll ? '拖曳卡片調整服務順序；點擊卡片開啟編輯。' : '點擊卡片開啟編輯；排序由經理或開發者管理。'} actions={<AdminButton variant="secondary" onClick={() => { const item = { id: newId(), serviceType: 'special', serviceName: '', serviceDescription: '', priceText: '', sortOrder: form.services.length, isEnabled: true }; update('services', [...form.services, item]); setEditingService(item); }}>新增服務</AdminButton>}>
            <AdminDragList items={form.services} canDrag={canManageAll} onReorder={reorderServices} onItemClick={(item) => setEditingService({ ...item })} renderItem={(item) => <><div><strong>{item.serviceName || '未命名服務'}</strong><small>{item.serviceType === 'common' ? '一般服務' : '特殊服務'} · {item.priceText || '未設定價格'}</small></div><div className="adminDragCardMeta"><em>{item.isEnabled ? '啟用' : '停用'}</em><AdminButton variant="danger" onClick={(event) => { event.stopPropagation(); update('services', form.services.filter((service) => service.id !== item.id)); }}>刪除</AdminButton></div></>} emptyText="尚無服務內容。" />
          </AdminPanel>

          <AdminPanel title="店員相簿" description={canManageAll ? '拖曳卡片調整相簿順序；點擊卡片開啟編輯。選擇圖片後先在本機預覽，儲存店員資料時才上傳。' : '點擊卡片開啟編輯；排序由經理或開發者管理。選擇圖片後先在本機預覽。'} actions={<AdminButton variant="secondary" onClick={() => { const item = { id: newId(), mediaId: null, imageUrl: '', sortOrder: form.gallery.length, isPublished: true, _file: null }; update('gallery', [...form.gallery, item]); setEditingGallery(item); }}>新增圖片</AdminButton>}>
            <AdminDragList items={form.gallery} canDrag={canManageAll} onReorder={reorderGallery} onItemClick={(item) => setEditingGallery({ ...item })} renderItem={(item) => <><div className="adminDragCardWithImage">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<div><strong>{item.imageUrl ? '店員相簿圖片' : '尚未選擇圖片'}</strong><small>{item.isPublished ? '公開' : '隱藏'}</small></div></div><div className="adminDragCardMeta"><AdminButton variant="danger" onClick={(event) => { event.stopPropagation(); update('gallery', form.gallery.filter((gallery) => gallery.id !== item.id)); }}>移除</AdminButton></div></>} emptyText="尚無相簿圖片。" />
          </AdminPanel>
          {canManageAll ? <div className="adminDangerZone"><AdminButton variant="danger" onClick={deleteStaff}>刪除此店員</AdminButton></div> : null}
        </> : <AdminPanel title="尚無可編輯資料"><p className="adminEmptyText">目前帳號尚未綁定店員資料，請先由經理建立關聯。</p></AdminPanel>}
      </> : null}

      <AdminDialog open={Boolean(editingService)} title={editingService?.serviceName || '編輯服務'} onClose={() => setEditingService(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingService(null)}>取消</AdminButton><AdminButton onClick={saveServiceEditor}>完成編輯</AdminButton></>}>
        {editingService ? <div className="adminFormGrid"><AdminField label="類型"><select value={editingService.serviceType} onChange={(event) => setEditingService((current) => ({ ...current, serviceType: event.target.value }))}><option value="common">一般</option><option value="special">特殊</option></select></AdminField><AdminField label="服務名稱"><input value={editingService.serviceName} onChange={(event) => setEditingService((current) => ({ ...current, serviceName: event.target.value }))} autoFocus /></AdminField><AdminField label="價格文字"><input value={editingService.priceText || ''} onChange={(event) => setEditingService((current) => ({ ...current, priceText: event.target.value }))} /></AdminField><AdminField label="說明" className="span-2"><textarea rows="5" value={editingService.serviceDescription} onChange={(event) => setEditingService((current) => ({ ...current, serviceDescription: event.target.value }))} /></AdminField><div className="adminFormWide"><AdminToggle checked={editingService.isEnabled} onChange={(value) => setEditingService((current) => ({ ...current, isEnabled: value }))} /></div></div> : null}
      </AdminDialog>

      <AdminDialog open={Boolean(editingGallery)} title="編輯店員相簿圖片" onClose={() => setEditingGallery(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingGallery(null)}>取消</AdminButton><AdminButton onClick={saveGalleryEditor}>完成編輯</AdminButton></>}>
        {editingGallery ? <div className="adminFormGrid"><AdminImagePicker label="相簿圖片" value={editingGallery.imageUrl} pendingFile={editingGallery._file} onChange={(file) => setEditingGallery((current) => ({ ...current, _file: file }))} onClear={() => setEditingGallery((current) => ({ ...current, _file: null, imageUrl: '', mediaId: null }))} /><div><AdminToggle checked={editingGallery.isPublished} onChange={(value) => setEditingGallery((current) => ({ ...current, isPublished: value }))} label="公開" /><p className="adminFieldHint">排序請回到卡片清單拖曳調整。</p></div></div> : null}
      </AdminDialog>
    </AdminPage>
  );
}
