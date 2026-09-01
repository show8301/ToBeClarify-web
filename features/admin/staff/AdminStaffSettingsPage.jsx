import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '@/features/admin/api/client.js';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext.jsx';
import { AdminAvatarPicker } from '@/features/admin/media/AdminAvatarPicker.jsx';
import { cleanupAdminMedia } from '@/features/admin/media/adminMedia.js';
import { useAdminToast } from '@/features/admin/shared/AdminToastProvider.jsx';
import {
  AdminButton, AdminDialog, AdminDragList, AdminField, AdminImagePicker, AdminPage, AdminPanel, AdminState,
  AdminToggle, newId,
} from '@/features/admin/shared/AdminShared.jsx';

const emptyStaff = {
  id: '', displayName: '', nickname: '', avatarMediaId: null, avatarUrl: '', avatarFile: null, avatarPreviewUrl: '',
  signatureSupported: false, signatureMediaId: null, signatureUrl: '', signatureFile: null, signaturePreviewUrl: '',
  roleTitle: '', shortBio: '', profileBio: '', isWorkingToday: true,
  bufferMinutes: '', isNominatable: false,
  sortOrder: 0, isActive: true, services: [], gallery: [],
};

function optionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function priceFromText(value) {
  const match = String(value || '').match(/([\d,]+)\s*(?:gil|g)(?:\b|$)/i);
  return match ? Number(match[1].replaceAll(',', '')) : '';
}

function durationFromText(value) {
  const match = String(value || '').match(/(\d+)\s*(?:min|分鐘)/i);
  return match ? Number(match[1]) : '';
}

function toServiceEditor(item) {
  return {
    ...item,
    price: item.price ?? priceFromText(item.priceText),
    durationMinutes: item.durationMinutes ?? item.duration ?? durationFromText(item.priceText),
    isNominatable: item.isNominatable ?? item.canNominate ?? true,
    additionalPersonPrice: item.additionalPersonPrice ?? '',
  };
}

function servicePriceText(item) {
  const override = String(item.priceText || '').trim();
  if (override) return override;
  const price = optionalNumber(item.price);
  return price !== null ? `${price.toLocaleString('en-US')} Gil` : '';
}

function serviceDurationText(item) {
  const duration = optionalNumber(item.durationMinutes);
  return duration !== null ? `${duration} 分鐘` : '';
}

function serviceAdditionalPriceText(item) {
  const price = optionalNumber(item.additionalPersonPrice);
  return price !== null ? `每位額外 +${price.toLocaleString('en-US')} Gil` : '';
}

function serviceMeta(item) {
  const price = optionalNumber(item.price);
  const duration = optionalNumber(item.durationMinutes);
  const override = String(item.priceText || '').trim();
  return [
    item.serviceType === 'common' ? '一般服務' : '特殊服務',
    override || (price !== null ? `${price.toLocaleString('en-US')} Gil` : '未設定價格'),
    duration !== null ? `${duration} 分鐘` : '未設定時間',
    optionalNumber(item.additionalPersonPrice) !== null ? `每位額外 ${Number(item.additionalPersonPrice).toLocaleString('en-US')} Gil` : '未設定額外人數價格',
  ].join(' · ');
}

function toEditor(value) {
  return {
    ...emptyStaff,
    ...value,
    signatureSupported: Object.prototype.hasOwnProperty.call(value || {}, 'signatureMediaId') || Object.prototype.hasOwnProperty.call(value || {}, 'signatureUrl'),
    avatarFile: null,
    avatarPreviewUrl: '',
    signatureFile: null,
    signaturePreviewUrl: '',
    services: (value.services || []).map(toServiceEditor),
    gallery: (value.gallery || []).map((item) => ({ ...item, _file: null, _previewUrl: '' })),
  };
}

function getDraftImageUrl(item) {
  return item?._previewUrl || item?.imageUrl || '';
}

function getPreviewGalleryItems(form) {
  return (form.gallery || [])
    .filter((item) => item.isPublished && getDraftImageUrl(item))
    .map((item) => ({ ...item, imageUrl: getDraftImageUrl(item) }));
}

export function AdminStaffSettingsPage() {
  const { user } = useAdminAuth();
  const toast = useAdminToast();
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState(emptyStaff);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailPreviewOpen, setDetailPreviewOpen] = useState(false);
  const [previewGalleryId, setPreviewGalleryId] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [editingGallery, setEditingGallery] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });
  const [saving, setSaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [statusSavingIds, setStatusSavingIds] = useState(() => new Set());
  const [staffOrderDirty, setStaffOrderDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const localPreviewUrlsRef = useRef(new Set());
  const staffDetailRequestRef = useRef(null);
  const [editorLoadingId, setEditorLoadingId] = useState(null);
  const isClerk = user.role === 'clerk';
  const canManageAll = user.role === 'developer' || user.role === 'manager';
  const canEditSelected = canManageAll || (isClerk && form.id === user.staffMemberId);
  const isReadOnly = Boolean(form.id) && !canEditSelected;

  const createLocalPreview = (file) => {
    if (!file) return '';
    const url = URL.createObjectURL(file);
    localPreviewUrlsRef.current.add(url);
    return url;
  };

  useEffect(() => {
    const activeUrls = new Set([
      form.avatarPreviewUrl,
      form.signaturePreviewUrl,
      ...form.gallery.map((item) => item._previewUrl),
      editingGallery?._previewUrl,
    ].filter(Boolean));

    for (const url of localPreviewUrlsRef.current) {
      if (!activeUrls.has(url)) {
        URL.revokeObjectURL(url);
        localPreviewUrlsRef.current.delete(url);
      }
    }
  }, [form, editingGallery]);

  useEffect(() => () => {
    staffDetailRequestRef.current?.controller.abort();
    for (const url of localPreviewUrlsRef.current) URL.revokeObjectURL(url);
    localPreviewUrlsRef.current.clear();
  }, []);

  const load = async () => {
    setState({ loading: true, error: null });
    try {
      const items = await adminApi.getStaffMembers();
      setStaffList(items);
      setStaffOrderDirty(false);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  useEffect(() => { load(); }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const updateAvatarFile = (file) => {
    const previewUrl = createLocalPreview(file);
    setForm((current) => ({ ...current, avatarFile: file, avatarPreviewUrl: previewUrl }));
  };

  const updateSignatureFile = (file) => {
    const previewUrl = createLocalPreview(file);
    setForm((current) => ({ ...current, signatureFile: file, signaturePreviewUrl: previewUrl }));
  };

  const updateGalleryFile = (file) => {
    const previewUrl = createLocalPreview(file);
    setEditingGallery((current) => ({ ...current, _file: file, _previewUrl: previewUrl }));
  };

  const openEditor = async (staff) => {
    staffDetailRequestRef.current?.controller.abort();
    const request = { controller: new AbortController(), staffId: staff.id };
    staffDetailRequestRef.current = request;
    setEditorLoadingId(staff.id);
    setMessage(`正在載入${staff.displayName}的完整資料…`);
    try {
      const detail = await adminApi.getStaffMember(staff.id, request.controller.signal);
      if (staffDetailRequestRef.current !== request) return;
      setForm(toEditor(detail));
      setEditorOpen(true);
      setDetailPreviewOpen(false);
      setPreviewGalleryId(null);
      setEditingService(null);
      setEditingGallery(null);
      setMessage('');
    } catch (error) {
      if (error.name !== 'AbortError' && staffDetailRequestRef.current === request) {
        setMessage(`載入${staff.displayName}的完整資料失敗：${error.message}`);
      }
    } finally {
      if (staffDetailRequestRef.current === request) {
        staffDetailRequestRef.current = null;
        setEditorLoadingId(null);
      }
    }
  };

  const closeEditor = () => {
    setDeleteConfirmOpen(false);
    setEditorOpen(false);
    setDetailPreviewOpen(false);
  };

  const reorderStaff = (items) => {
    if (!canManageAll) return;
    setStaffList(items);
    setStaffOrderDirty(true);
  };

  const saveStaffOrder = async () => {
    if (!canManageAll || !staffOrderDirty) return;
    setOrderSaving(true);
    try {
      await adminApi.reorderStaffMembers(staffList.map((item, index) => ({ id: item.id, sortOrder: index })));
      setStaffOrderDirty(false);
      setMessage('');
      toast.add({ title: '操作完成', description: '店員順序已儲存。', type: 'success' });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setOrderSaving(false);
    }
  };

  const toggleStaffStatus = async (item, field, value) => {
    const canChange = canManageAll || item.id === user.staffMemberId;
    if (!canChange || statusSavingIds.has(item.id)) return;
    const previous = item[field];
    setStaffList((current) => current.map((staff) => staff.id === item.id ? { ...staff, [field]: value } : staff));
    if (form.id === item.id) setForm((current) => ({ ...current, [field]: value }));
    setStatusSavingIds((current) => new Set(current).add(item.id));
    try {
      const saved = await adminApi.updateStaffMemberStatus(item.id, { [field]: value });
      setStaffList((current) => current.map((staff) => staff.id === item.id ? saved : staff));
      if (form.id === item.id) setForm((current) => ({ ...current, [field]: saved[field] }));
      setMessage('');
      toast.add({ title: '操作完成', description: `${field === 'isActive' ? '公開狀態' : '今日上班狀態'}已更新。`, type: 'success' });
    } catch (error) {
      setStaffList((current) => current.map((staff) => staff.id === item.id ? { ...staff, [field]: previous } : staff));
      if (form.id === item.id) setForm((current) => ({ ...current, [field]: previous }));
      setMessage(error.message);
    } finally {
      setStatusSavingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  const save = async () => {
    if (!canEditSelected || !form.id) return;
    const missingFields = [];
    if (!form.displayName?.trim()) missingFields.push('顯示名稱');
    if (!form.shortBio?.trim()) missingFields.push('卡片簡介');
    const bufferMinutes = optionalNumber(form.bufferMinutes);
    if (missingFields.length) {
      setMessage(`請填寫必填欄位：${missingFields.join('、')}。`);
      return;
    }
    const invalidService = (form.services || []).find((item) => (
      !['common', 'special'].includes(item.serviceType)
      || !item.serviceName?.trim()
      || !item.serviceDescription?.trim()
      || (optionalNumber(item.price) !== null && optionalNumber(item.price) < 0)
      || (optionalNumber(item.durationMinutes) !== null && optionalNumber(item.durationMinutes) < 0)
      || (optionalNumber(item.additionalPersonPrice) !== null && optionalNumber(item.additionalPersonPrice) < 0)
    ));
    if (bufferMinutes !== null && (bufferMinutes < 0 || bufferMinutes > 1440)) {
      setMessage('中間休息時間必須介於 0 到 1440 分鐘。');
      return;
    }
    if (invalidService) {
      setMessage('請先完成服務的類型、名稱與說明，並確認價格、時間與每位額外人數價格不可小於 0。');
      return;
    }
    setSaving(true);
    setMessage('');
    const uploadedMediaIds = [];
    try {
      let avatarMediaId = form.avatarMediaId || null;
      let avatarUrl = form.avatarUrl || null;
      if (form.avatarFile) {
        const uploaded = await adminApi.uploadMedia(form.avatarFile, 'staff');
        uploadedMediaIds.push(uploaded.id);
        avatarMediaId = uploaded.id;
        avatarUrl = uploaded.url;
      }
      let signatureMediaId = form.signatureSupported ? (form.signatureMediaId || null) : null;
      let signatureUrl = form.signatureSupported ? (form.signatureUrl || null) : null;
      if (form.signatureSupported && form.signatureFile) {
        const uploaded = await adminApi.uploadMedia(form.signatureFile, 'staff');
        uploadedMediaIds.push(uploaded.id);
        signatureMediaId = uploaded.id;
        signatureUrl = uploaded.url;
      }
      const gallery = [];
      for (const item of (form.gallery || []).filter((value) => value._file || value.mediaId)) {
        let mediaId = item.mediaId || null;
        let imageUrl = item.imageUrl || null;
        if (item._file) {
          const uploaded = await adminApi.uploadMedia(item._file, 'gallery');
          uploadedMediaIds.push(uploaded.id);
          mediaId = uploaded.id;
          imageUrl = uploaded.url;
        }
        gallery.push({
          id: item.id?.startsWith('local-') ? null : item.id,
          mediaId,
          imageUrl,
          sortOrder: gallery.length,
          isPublished: item.isPublished !== false,
        });
      }
      const saved = await adminApi.saveStaffMember(form.id, {
        displayName: form.displayName, nickname: form.nickname || null, avatarMediaId, avatarUrl,
        signatureMediaId, signatureUrl,
        roleTitle: form.roleTitle || null, shortBio: form.shortBio || null, profileBio: form.profileBio || null,
        isWorkingToday: form.isWorkingToday, bufferMinutes, isNominatable: form.isNominatable === true,
        sortOrder: canManageAll ? Number(form.sortOrder) || 0 : Number(staffList.find((item) => item.id === form.id)?.sortOrder) || 0,
        isActive: form.isActive,
        services: form.services.map((item) => ({
          id: item.id?.startsWith('local-') ? null : item.id, serviceType: item.serviceType,
          serviceName: item.serviceName, serviceDescription: item.serviceDescription,
          priceText: String(item.priceText || '').trim() || null,
          price: optionalNumber(item.price), durationMinutes: optionalNumber(item.durationMinutes),
          isNominatable: item.isNominatable !== false,
          additionalPersonPrice: optionalNumber(item.additionalPersonPrice),
          sortOrder: Number(item.sortOrder) || 0, isEnabled: item.isEnabled,
        })),
        gallery,
      });
      const savedWithFrontendServiceFields = {
        ...saved,
        services: (saved.services || []).map((item, index) => ({
          ...item,
          price: item.price ?? form.services[index]?.price ?? '',
          durationMinutes: item.durationMinutes ?? form.services[index]?.durationMinutes ?? '',
          isNominatable: item.isNominatable ?? form.services[index]?.isNominatable ?? true,
          additionalPersonPrice: item.additionalPersonPrice ?? form.services[index]?.additionalPersonPrice ?? '',
        })),
      };
      setForm(toEditor(savedWithFrontendServiceFields));
      setStaffList((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage('');
      toast.add({ title: '操作完成', description: '店員資料已儲存。', type: 'success' });
    } catch (error) {
      await cleanupAdminMedia(uploadedMediaIds);
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteStaff = async () => {
    if (!canManageAll || !form.id || deleting) return;
    setDeleting(true);
    try {
      await adminApi.deleteStaffMember(form.id);
      setDeleteConfirmOpen(false);
      setEditorOpen(false);
      setDetailPreviewOpen(false);
      setForm(emptyStaff);
      setMessage('');
      toast.add({ title: '刪除完成', description: '店員資料已刪除。', type: 'success' });
      await load();
    } catch (error) {
      setMessage(error.message);
      toast.add({ title: '刪除失敗', description: error.message, type: 'error', priority: 'high' });
    } finally {
      setDeleting(false);
    }
  };

  const saveServiceEditor = () => {
    if (!editingService || !canEditSelected) return;
    if (!['common', 'special'].includes(editingService.serviceType)
      || !editingService.serviceName?.trim()
      || !editingService.serviceDescription?.trim()
      || (optionalNumber(editingService.price) !== null && optionalNumber(editingService.price) < 0)
      || (optionalNumber(editingService.durationMinutes) !== null && optionalNumber(editingService.durationMinutes) < 0)
      || (optionalNumber(editingService.additionalPersonPrice) !== null && optionalNumber(editingService.additionalPersonPrice) < 0)) {
      setMessage('請填寫服務的類型、服務名稱與說明；價格、時間與每位額外人數價格不可小於 0。');
      return;
    }
    setForm((current) => ({ ...current, services: current.services.map((item) => item.id === editingService.id ? editingService : item) }));
    setEditingService(null);
  };

  const saveGalleryEditor = () => {
    if (!editingGallery || !canEditSelected) return;
    setForm((current) => ({
      ...current,
      gallery: getDraftImageUrl(editingGallery)
        ? current.gallery.map((item) => item.id === editingGallery.id ? editingGallery : item)
        : current.gallery.filter((item) => item.id !== editingGallery.id),
    }));
    setEditingGallery(null);
  };

  const cancelGalleryEditor = () => setEditingGallery(null);

  const previewForm = useMemo(() => ({
    ...form,
    services: editingService
      ? form.services.map((item) => item.id === editingService.id ? editingService : item)
      : form.services,
    gallery: editingGallery
      ? form.gallery.map((item) => item.id === editingGallery.id ? editingGallery : item)
      : form.gallery,
  }), [form, editingService, editingGallery]);

  const previewGalleryItems = useMemo(() => getPreviewGalleryItems(previewForm), [previewForm]);
  const previewImageIndex = Math.max(0, previewGalleryItems.findIndex((item) => item.id === previewGalleryId));
  const updatePreviewGalleryIndex = (index) => setPreviewGalleryId(previewGalleryItems[index]?.id || null);
  const openGalleryEditor = (item) => {
    setEditingGallery({ ...item });
    setPreviewGalleryId(item.id);
  };

  const selectedStaffLabel = useMemo(() => form.displayName || '尚未選擇', [form.displayName]);
  const previewNavigation = useMemo(() => {
    const publicStaff = staffList.filter((item) => item.isActive || item.id === form.id);
    const index = Math.max(0, publicStaff.findIndex((item) => item.id === form.id));
    const total = Math.max(publicStaff.length, 1);
    return {
      number: String(index + 1).padStart(2, '0'),
      total: String(total).padStart(2, '0'),
      previous: publicStaff[(index - 1 + publicStaff.length) % publicStaff.length]?.displayName || '—',
      next: publicStaff[(index + 1) % publicStaff.length]?.displayName || '—',
    };
  }, [form.id, staffList]);

  return (
    <AdminPage eyebrow="Staff Directory" title="店員設定" description="店員只能編輯各自的資料，其他人的資料只能檢視">
      {message ? <div className="adminNotice" role="alert">{message}</div> : null}
      <AdminState loading={state.loading} error={state.error} onRetry={load} />
      {!state.loading && !state.error ? <>
        <AdminPanel className="adminStaffListPanel" title="店員列表" description={canManageAll ? '拖曳卡片調整公開列表順序；排班與公開狀態會立即儲存。' : '可查看所有店員資料；只能修改自己的公開狀態與今日排班。'} actions={canManageAll ? <AdminButton variant="secondary" onClick={saveStaffOrder} disabled={!staffOrderDirty || orderSaving}>{orderSaving ? '儲存中…' : '儲存店員順序'}</AdminButton> : null}>
          <AdminDragList
            items={staffList}
            canDrag={canManageAll}
            onReorder={reorderStaff}
            onItemClick={openEditor}
            renderItem={(item) => {
              const canChange = canManageAll || item.id === user.staffMemberId;
              const statusSaving = statusSavingIds.has(item.id);
              return <>
                <div className="adminStaffListIdentity">
                  <div className="adminStaffListPortrait">
                    {item.avatarUrl ? <img src={item.avatarUrl} alt={`${item.displayName} 頭像預覽`} loading="lazy" decoding="async" /> : <span>{item.displayName?.trim()?.slice(0, 1) || 'LD'}</span>}
                    <i className={item.isWorkingToday ? 'isWorking' : ''} aria-hidden="true" />
                  </div>
                  <div className="adminStaffListCopy">
                    <div className="adminStaffListHeading">
                      <strong>{item.displayName}</strong>
                      <span className={item.isActive ? 'isPublic' : 'isHidden'}>{item.isActive ? '公開中' : '未公開'}</span>
                    </div>
                    <small className="adminStaffListRole">{item.roleTitle || '尚未設定角色'}</small>
                    <div className="adminStaffListSummary">
                      <span className={item.isWorkingToday ? 'isWorking' : ''}>{item.isWorkingToday ? '今日上班' : '今日休假'}</span>
                      {item.bufferMinutes === null || item.bufferMinutes === undefined ? null : <span className="adminStaffBufferLine">中間休息 {item.bufferMinutes} 分鐘</span>}
                    </div>
                  </div>
                </div>
                <div className={`adminStaffListControls ${statusSaving ? 'isSaving' : ''}`} onClick={(event) => event.stopPropagation()}>
                  <div className="adminStaffListControl">
                    <span className="adminStaffListControlLabel">今日排班</span>
                    <AdminToggle checked={item.isWorkingToday} disabled={!canChange || statusSaving} onChange={(value) => toggleStaffStatus(item, 'isWorkingToday', value)} label={item.isWorkingToday ? '上班' : '休假'} ariaLabel={`切換${item.displayName}今日有上班`} />
                  </div>
                  <div className="adminStaffListControl">
                    <span className="adminStaffListControlLabel">公開狀態</span>
                    <AdminToggle checked={item.isActive} disabled={!canChange || statusSaving} onChange={(value) => toggleStaffStatus(item, 'isActive', value)} label={item.isActive ? '公開' : '隱藏'} ariaLabel={`切換${item.displayName}公開狀態`} />
                  </div>
                  <AdminButton variant="ghost" className="adminStaffListEditButton" onClick={() => openEditor(item)} disabled={editorLoadingId === item.id}>{editorLoadingId === item.id ? '讀取中…' : canChange ? '編輯' : '查看'}<span aria-hidden="true">›</span></AdminButton>
                  {statusSaving ? <small role="status">狀態儲存中…</small> : null}
                </div>
              </>;
            }}
            emptyText="尚無店員資料。"
          />
        </AdminPanel>
      </> : null}

      <AdminDialog className="adminStaffEditDialog" open={editorOpen} title={`${isReadOnly ? '查看' : '編輯'}店員：${selectedStaffLabel}`} description={isReadOnly ? '目前帳號只能查看其他店員資料，不能修改或儲存。' : '修改資料時會同步更新公開卡片預覽；詳細資料也可另開視窗查看。'} onClose={closeEditor} actions={<>{canManageAll ? <AdminButton variant="danger" onClick={() => setDeleteConfirmOpen(true)}>刪除此店員</AdminButton> : null}<span className="adminDialogActionSpacer" /><AdminButton variant="ghost" onClick={closeEditor}>關閉</AdminButton>{canEditSelected ? <AdminButton onClick={save} disabled={saving}>{saving ? '儲存中…' : '儲存店員資料'}</AdminButton> : null}</>}>
        {form.id ? <>
          {message ? <div className="adminNotice adminDialogNotice" role="alert">{message}</div> : null}
          <div className="adminStaffMobilePreviewAction"><AdminButton variant="secondary" onClick={() => setDetailPreviewOpen(true)}>預覽公開卡片</AdminButton></div>
          <div className="adminStaffEditorLayout">
          <div className="adminStaffEditorForm">
            <AdminPanel title="基本資料" description="公開店員卡片與詳細內容會使用這些欄位。紅色＊為必填欄位" className="adminFormPanel">
              <div className="adminFormGrid">
                <AdminField label="顯示名稱" required><input required disabled={isReadOnly} value={form.displayName} onChange={(event) => update('displayName', event.target.value)} /></AdminField>
                <AdminField label="暱稱"><input disabled={isReadOnly} value={form.nickname || ''} onChange={(event) => update('nickname', event.target.value)} /></AdminField>
                <AdminField label="角色標籤"><input disabled={isReadOnly} value={form.roleTitle || ''} onChange={(event) => update('roleTitle', event.target.value)} /></AdminField>
                <AdminField label="中間休息時間"><input type="number" min="0" max="1440" step="5" inputMode="numeric" disabled={isReadOnly} value={form.bufferMinutes ?? ''} onChange={(event) => update('bufferMinutes', event.target.value === '' ? '' : Number(event.target.value))} /><small>單位：分鐘；非必填，僅供後台自動排程使用。</small></AdminField>
                <div className="adminStaffBasicToggle"><AdminToggle checked={form.isNominatable === true} disabled={isReadOnly} onChange={(value) => update('isNominatable', value)} label="開放指名" /><small>必填狀態，預設關閉；公開卡片會依此顯示「可以指名」。</small></div>
                <AdminField label="卡片簡介" className="span-2" required><textarea required disabled={isReadOnly} rows="3" value={form.shortBio || ''} onChange={(event) => update('shortBio', event.target.value)} /></AdminField>
                <AdminField label="詳細介紹" className="span-2"><textarea disabled={isReadOnly} rows="7" value={form.profileBio || ''} onChange={(event) => update('profileBio', event.target.value)} /></AdminField>
                <AdminAvatarPicker label="頭像" value={form.avatarUrl} pendingFile={form.avatarFile} hint="選擇圖片後會開啟 4:5 裁切框，輸出固定為 1200 × 1500px WebP；既有頭像也能重新調整。儲存店員資料後才會正式上傳。" disabled={isReadOnly} onChange={updateAvatarFile} onClear={() => { update('avatarFile', null); update('avatarPreviewUrl', ''); update('avatarUrl', ''); update('avatarMediaId', null); }} />
                <AdminAvatarPicker kind="signature" label="顯示名稱簽名圖" value={form.signatureUrl} pendingFile={form.signatureFile} hint={form.signatureSupported ? "選擇帶透明背景的 PNG 或 WebP 後會開啟 3:2 裁切框，輸出為保留透明通道的 1200 × 800px WebP。上傳後公開卡片會用簽名圖取代文字顯示名稱；未上傳時仍顯示文字。" : "目前 API 尚未提供簽名圖欄位；待 API 更新後此功能會自動啟用。"} disabled={isReadOnly || !form.signatureSupported} onChange={updateSignatureFile} onClear={() => { update('signatureFile', null); update('signaturePreviewUrl', ''); update('signatureUrl', ''); update('signatureMediaId', null); }} />
              </div>
            </AdminPanel>

            <AdminPanel title="服務內容" description={canManageAll ? '拖曳卡片調整服務順序；指名資格統一由基本資料的「開放指名」控制。' : '可查看服務內容；指名資格統一由基本資料控制。'} actions={canEditSelected ? <AdminButton variant="secondary" onClick={() => { const item = { id: newId(), serviceType: 'special', serviceName: '', serviceDescription: '', priceText: '', price: '', durationMinutes: '', isNominatable: true, additionalPersonPrice: '', sortOrder: form.services.length, isEnabled: true }; update('services', [...form.services, item]); setEditingService(item); }}>新增服務</AdminButton> : null}>
              <AdminDragList items={form.services} canDrag={canManageAll} onReorder={(items) => canEditSelected && update('services', items)} onItemClick={(item) => setEditingService({ ...item })} renderItem={(item) => <><div><strong>{item.serviceName || '未命名服務'}</strong><small>{serviceMeta(item)}</small></div><div className="adminDragCardMeta" onClick={(event) => event.stopPropagation()}><AdminToggle checked={item.isEnabled} disabled={!canEditSelected} onChange={(value) => update('services', form.services.map((service) => service.id === item.id ? { ...service, isEnabled: value } : service))} label="" ariaLabel={`切換${item.serviceName || '此服務'}啟用狀態`} />{canEditSelected ? <AdminButton variant="danger" onClick={() => update('services', form.services.filter((service) => service.id !== item.id))}>刪除</AdminButton> : null}</div></>} emptyText="尚無服務內容。" />
            </AdminPanel>

            <AdminPanel title="店員相簿" description={canManageAll ? '拖曳卡片調整相簿順序；圖片預覽已放大。' : '可查看相簿內容；只有自己的資料可以修改。'} actions={canEditSelected ? <AdminButton variant="secondary" onClick={() => { const item = { id: newId(), mediaId: null, imageUrl: '', sortOrder: form.gallery.length, isPublished: true, _file: null }; update('gallery', [...form.gallery, item]); setEditingGallery(item); }}>新增圖片</AdminButton> : null}>
              <AdminDragList items={form.gallery} canDrag={canManageAll} onReorder={(items) => canEditSelected && update('gallery', items)} onItemClick={openGalleryEditor} renderItem={(item) => { const imageUrl = getDraftImageUrl(item); return <><div className="adminDragCardWithImage adminStaffGalleryCard">{imageUrl ? <img src={imageUrl} alt="" /> : null}<div><strong>{imageUrl ? '店員相簿圖片' : '尚未選擇圖片'}</strong><small>{item.isPublished ? '公開' : '隱藏'}</small></div></div><div className="adminDragCardMeta" onClick={(event) => event.stopPropagation()}>{canEditSelected ? <AdminButton variant="danger" onClick={() => update('gallery', form.gallery.filter((gallery) => gallery.id !== item.id))}>移除</AdminButton> : null}</div></>; }} emptyText="尚無相簿圖片。" />
            </AdminPanel>
          </div>
          <StaffPreview form={previewForm} navigation={previewNavigation} onOpenDetail={() => setDetailPreviewOpen(true)} />
          </div>
        </> : null}
      </AdminDialog>

      <AdminDialog
        className="adminDeleteConfirmDialog"
        open={deleteConfirmOpen}
        title="確定刪除店員？"
        description="此操作無法復原，相關公開資料也會一併移除。"
        onClose={() => { if (!deleting) setDeleteConfirmOpen(false); }}
        actions={<><AdminButton variant="ghost" autoFocus disabled={deleting} onClick={() => setDeleteConfirmOpen(false)}>取消</AdminButton><AdminButton variant="danger" disabled={deleting} onClick={deleteStaff}>{deleting ? '刪除中…' : `確認刪除「${selectedStaffLabel}」`}</AdminButton></>}
      >
        <div className="adminDeleteConfirmContent">
          <span aria-hidden="true">!</span>
          <div><strong>{selectedStaffLabel}</strong><p>刪除後無法從後台復原。請確認目前選取的是正確店員。</p></div>
        </div>
      </AdminDialog>

      <AdminDialog className="adminStaffDetailPreviewDialog" open={detailPreviewOpen} title={`詳細資料預覽：${selectedStaffLabel}`} showHeader={false} onClose={() => setDetailPreviewOpen(false)}>
        <StaffDetailPreview form={previewForm} navigation={previewNavigation} imageIndex={previewImageIndex} onImageChange={updatePreviewGalleryIndex} onClose={() => setDetailPreviewOpen(false)} />
      </AdminDialog>

      <AdminDialog open={Boolean(editingService)} title={editingService?.serviceName || '查看服務'} description={canEditSelected ? '服務啟用狀態也可以直接在服務列表右側切換。' : '目前為唯讀模式。'} onClose={() => setEditingService(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingService(null)}>關閉</AdminButton>{canEditSelected ? <AdminButton onClick={saveServiceEditor}>完成編輯</AdminButton> : null}</>}>
        {editingService ? <>
          <div className="adminNotice adminDialogNotice" role="alert">{message || '標示 * 的欄位為必填。數值欄位留白代表未設定。'}</div>
          <div className="adminFormGrid">
            <AdminField label="類型" required><select required disabled={!canEditSelected} value={editingService.serviceType} onChange={(event) => setEditingService((current) => ({ ...current, serviceType: event.target.value }))}><option value="common">一般</option><option value="special">特殊</option></select></AdminField>
            <AdminField label="服務名稱" required><input required disabled={!canEditSelected} value={editingService.serviceName} onChange={(event) => setEditingService((current) => ({ ...current, serviceName: event.target.value }))} autoFocus /></AdminField>
            <AdminField label="價格"><input type="number" min="0" step="1" inputMode="numeric" disabled={!canEditSelected} value={editingService.price ?? ''} onChange={(event) => setEditingService((current) => ({ ...current, price: event.target.value === '' ? '' : Number(event.target.value) }))} /><small>單位：Gil</small></AdminField>
            <AdminField label="價格文字（選填）"><input maxLength="80" disabled={!canEditSelected} value={editingService.priceText || ''} onChange={(event) => setEditingService((current) => ({ ...current, priceText: event.target.value }))} /><small>填寫時會優先取代數值價格顯示，例如「期間限定優惠」。</small></AdminField>
            <AdminField label="時間"><input type="number" min="0" step="5" inputMode="numeric" disabled={!canEditSelected} value={editingService.durationMinutes ?? ''} onChange={(event) => setEditingService((current) => ({ ...current, durationMinutes: event.target.value === '' ? '' : Number(event.target.value) }))} /><small>單位：分鐘</small></AdminField>
            <AdminField label="每位額外人數價格"><input type="number" min="0" step="1" inputMode="numeric" disabled={!canEditSelected} value={editingService.additionalPersonPrice ?? ''} onChange={(event) => setEditingService((current) => ({ ...current, additionalPersonPrice: event.target.value === '' ? '' : Number(event.target.value) }))} /><small>單位：Gil／每位額外人數</small></AdminField>
            <AdminField label="說明" className="span-2" required><textarea required disabled={!canEditSelected} rows="5" value={editingService.serviceDescription} onChange={(event) => setEditingService((current) => ({ ...current, serviceDescription: event.target.value }))} /></AdminField>
            <div className="adminServiceToggleFields"><AdminToggle checked={editingService.isEnabled} disabled={!canEditSelected} onChange={(value) => setEditingService((current) => ({ ...current, isEnabled: value }))} label="公開顯示" /></div>
          </div>
        </> : null}
      </AdminDialog>

      <AdminDialog open={Boolean(editingGallery)} title="編輯店員相簿圖片" description={canEditSelected ? '選擇圖片後會先套用到編輯草稿；按下店員資料儲存後才會上傳。' : '目前為唯讀模式。'} onClose={canEditSelected ? saveGalleryEditor : cancelGalleryEditor} actions={<><AdminButton variant="ghost" onClick={cancelGalleryEditor}>取消</AdminButton>{canEditSelected ? <AdminButton onClick={saveGalleryEditor}>套用圖片</AdminButton> : null}</>}>
        {editingGallery ? <><div className="adminNotice adminDialogNotice" role="alert">{message || '標示 * 的欄位為必填。'}</div><div className="adminFormGrid"><AdminImagePicker label="相簿圖片" required value={editingGallery.imageUrl} pendingFile={editingGallery._file} disabled={!canEditSelected} onChange={updateGalleryFile} onClear={() => setEditingGallery((current) => ({ ...current, _file: null, _previewUrl: '', imageUrl: '', mediaId: null }))} /><div><AdminToggle checked={editingGallery.isPublished} disabled={!canEditSelected} onChange={(value) => setEditingGallery((current) => ({ ...current, isPublished: value }))} label="公開" /><p className="adminFieldHint">排序請回到相簿列表拖曳調整。</p></div></div></> : null}
      </AdminDialog>
    </AdminPage>
  );
}

function StaffPreview({ form, navigation, onOpenDetail }) {
  return <aside className="adminStaffPreview">
    <div className="adminStaffPreviewHeader">
      <p className="eyebrow">Live Preview</p>
      <h2>公開卡片</h2>
      <small>{form.isActive ? '依新版店員名單的實際卡片比例呈現' : '目前設為不公開，儲存後不會出現在名單中'}</small>
    </div>
    <div className="adminStaffPreviewControls">
      <span className="adminStaffPreviewCurrent">公開卡片</span>
      <AdminButton variant="ghost" className="adminPreviewDetailButton" onClick={onOpenDetail}>詳細資料預覽 ↗</AdminButton>
    </div>
    <div className="adminStaffPreviewViewport">
      <StaffPublicCard form={form} navigation={navigation} />
    </div>
  </aside>;
}

function StaffPublicCard({ form, navigation }) {
  const displayName = form.displayName || form.nickname || '未命名店員';
  const nickname = form.nickname && form.nickname !== form.displayName ? form.nickname : '';
  const role = form.roleTitle || 'DREAM STAFF';
  const avatarUrl = form.avatarPreviewUrl || form.avatarUrl;
  const signatureUrl = form.signaturePreviewUrl || form.signatureUrl;
  const services = form.services.filter((item) => item.isEnabled);
  const isNominatable = form.isNominatable === true;
  return <article className={`adminRosterCardPreview ${form.isActive ? '' : 'isHidden'}`.trim()}>
    <div className="adminRosterCardPhoto">
      {avatarUrl ? <img src={avatarUrl} alt="" /> : <div className="adminPreviewImageFallback">尚無頭像</div>}
      <span className="adminRosterRoleRibbon"><i>✦</i><b>{role}</b><i>✦</i></span>
    </div>
    <div className="adminRosterStatusBar">
      <span className={`adminRosterDuty ${form.isWorkingToday ? 'isOnline' : ''}`}><i /><small>{form.isWorkingToday ? 'ON DUTY' : 'OFF DUTY'}<b>{form.statusText || (form.isWorkingToday ? '待命中' : '未排班')}</b></small></span>
      <strong>{navigation.number}</strong>
      <span className="adminRosterNomination">✦ {isNominatable ? '可以指名' : '暫不開放指名'}</span>
    </div>
    <div className="adminRosterCardBody">
      <div className="adminRosterCardHeading">
        {signatureUrl ? <img src={signatureUrl} alt={`${displayName} 的簽名`} /> : <h2>{displayName}</h2>}
      </div>
      {nickname ? <em>✦　暱稱｜{nickname}　✦</em> : null}
      <p>{form.shortBio || '這位夢境成員正在準備自己的介紹。'}</p>
      <div className="adminRosterCardLower">
        {services.length ? <div className="adminRosterServiceChips" aria-label="可提供服務">{services.slice(0, 2).map((item, index) => <span key={item.id}><img src={`/assets/staff-card-chip-icon-${index === 0 ? 'a' : 'b'}.png`} alt="" />{item.serviceName}</span>)}{services.length > 2 ? <i><img src="/assets/staff-card-chip-icon-c.png" alt="" />+{services.length - 2}</i> : null}</div> : null}
        <footer><small>FILE · {navigation.number}</small><b>VIEW PROFILE ↗</b></footer>
      </div>
    </div>
  </article>;
}

function StaffDetailPreview({ form, navigation, imageIndex = 0, onImageChange, onClose }) {
  const displayName = form.displayName || form.nickname || '未命名店員';
  const role = form.roleTitle || 'DREAM STAFF';
  const avatarUrl = form.avatarPreviewUrl || form.avatarUrl;
  const galleryItems = getPreviewGalleryItems(form);
  const images = galleryItems.length ? galleryItems : (avatarUrl ? [{ id: 'avatar', imageUrl: avatarUrl }] : []);
  const activeImageIndex = Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0));
  const portraitUrl = avatarUrl;
  const services = form.services.filter((item) => item.isEnabled);
  return <div className="adminPreviewProfileSpread">
    <header className="adminPreviewProfileHeader">
      <div><small>清醒夢　·　PERSONNEL FILE</small><b>{displayName}</b></div>
      <div className="adminPreviewProfileSwitcher" aria-label="公開頁面相鄰店員預覽">
        <span><small>PREV</small><b>←　{navigation.previous}</b></span>
        <em>{navigation.number} / {navigation.total}</em>
        <span><small>NEXT</small><b>{navigation.next}　→</b></span>
      </div>
      <button type="button" onClick={onClose}>BACK TO EDITOR　←</button>
    </header>
    <div className="adminPreviewPortraitZone">
      <div className="adminPreviewPolaroid">
        <div className="adminPreviewPolaroidPhoto">{portraitUrl ? <img src={portraitUrl} alt="" /> : <div className="adminPreviewImageFallback">尚無店員照片</div>}</div>
        <footer><b>{displayName}</b><small>PORTRAIT / 01</small></footer>
      </div>
      <div className={`adminPreviewDutyStamp ${form.isWorkingToday ? 'isOnline' : ''}`}><i /><span><small>ON DUTY　·　TODAY</small><b>{form.statusText || (form.isWorkingToday ? '待命中' : '未排班')}</b></span><em>LD</em></div>
    </div>
    <div className="adminPreviewDossier">
      <div className="adminPreviewDossierHead"><div><small>DISPLAY NAME</small><h2>{displayName}</h2></div><b>{navigation.number}</b></div>
      <div className="adminPreviewRoleRow"><span>{role}</span>{form.nickname ? <i>AKA.　{form.nickname}</i> : null}</div>
      <div className="adminPreviewDossierScroll">
        <section>
          <header><b>影像紀錄</b><span>PHOTO ARCHIVE</span></header>
          <div className="adminPreviewFilmstrip">{images.map((image, index) => <button type="button" className={index === activeImageIndex ? 'isActive' : ''} key={image.id} onClick={() => onImageChange(index)} aria-label={`預覽第 ${index + 1} 張照片`}><img src={image.imageUrl} alt="" /><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div>
        </section>
        <section>
          <header><b>人物誌</b><span>PROFILE NOTE</span></header>
          <p>{form.profileBio || form.shortBio || '這位夢境成員正在準備自己的介紹。'}</p>
        </section>
        <section>
          <header><b>服務項目</b><span>{services.length} SERVICES</span></header>
          <div className="adminPreviewServiceGrid">{services.map((item, index) => <article key={item.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{item.serviceName}</h3><p>{item.serviceDescription}</p></div>
            {servicePriceText(item) || serviceDurationText(item) || serviceAdditionalPriceText(item) ? <div className="adminPreviewServicePrice">{servicePriceText(item) ? <b>{servicePriceText(item)}</b> : null}{serviceDurationText(item) ? <small>{serviceDurationText(item)}</small> : null}{serviceAdditionalPriceText(item) ? <small>{serviceAdditionalPriceText(item)}</small> : null}</div> : null}
          </article>)}</div>
        </section>
      </div>
      <footer><span>RECORD ID　·　{String(form.id || '').slice(0, 13)}</span><b>LUCID DREAM　✦</b></footer>
    </div>
  </div>;
}
