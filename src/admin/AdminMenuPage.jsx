import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api/client.js';
import {
  AdminButton, AdminDialog, AdminDragList, AdminField, AdminImagePicker, AdminPage, AdminPanel, AdminState, AdminToggle,
  newId,
} from './AdminShared.jsx';
import { cleanupAdminMedia } from './adminMedia.js';

const tabs = [['pricing', '消費規則'], ['categories', '分類'], ['items', '餐點品項'], ['sets', '套餐']];
const emptyPricing = { id: '', title: '', description: '', priceText: '', sortOrder: 0, isEnabled: true };
const emptyCategory = { id: '', categoryName: '', categoryDescription: '', sortOrder: 0, isEnabled: true };
const emptyItem = { id: '', categoryId: '', itemName: '', itemDescription: '', price: 0, mediaId: null, imageUrl: '', imageFile: null, tagsText: '', sortOrder: 0, isAvailable: true };
const emptySet = { id: '', setName: '', setDescription: '', setPrice: 0, mediaId: null, imageUrl: '', imageFile: null, sortOrder: 0, isAvailable: true, items: [] };

export function AdminMenuPage() {
  const [menu, setMenu] = useState({ pricingRules: [], categories: [], sets: [] });
  const [tab, setTab] = useState('pricing');
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });
  const [saving, setSaving] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [message, setMessage] = useState('');
  const allItems = useMemo(() => menu.categories.flatMap((category) => category.items || []), [menu.categories]);

  const load = async () => {
    setState({ loading: true, error: null });
    try {
      setMenu(await adminApi.getMenu());
      setOrderDirty(false);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (type, value) => setEditing({ type, form: toForm(type, value) });
  const updateEditing = (key, value) => setEditing((current) => ({ ...current, form: { ...current.form, [key]: value } }));

  const create = () => {
    const type = tab;
    const form = toForm(type);
    form.id = newId();
    if (type === 'items') form.categoryId = menu.categories[0]?.id || '';
    setEditing({ type, form });
    setMessage('');
  };

  const updateCategoryItems = (categoryId, items) => {
    setMenu((current) => ({ ...current, categories: current.categories.map((category) => category.id === categoryId ? { ...category, items } : category) }));
    setOrderDirty(true);
  };

  const saveEditing = async () => {
    if (!editing) return;
    setSaving(true);
    setMessage('');
    const uploadedMediaIds = [];
    try {
      const { type, form } = editing;
      let saved;
      if (type === 'pricing') {
        saved = await adminApi.savePricingRule(localId(form.id), { title: form.title, description: form.description, priceText: form.priceText || null, sortOrder: Number(form.sortOrder) || 0, isEnabled: form.isEnabled });
        setMenu((current) => ({ ...current, pricingRules: upsert(current.pricingRules, saved) }));
      }
      if (type === 'categories') {
        saved = await adminApi.saveMenuCategory(localId(form.id), { categoryName: form.categoryName, categoryDescription: form.categoryDescription || null, sortOrder: Number(form.sortOrder) || 0, isEnabled: form.isEnabled });
        setMenu((current) => ({ ...current, categories: upsert(current.categories, { ...saved, items: current.categories.find((category) => category.id === form.id)?.items || [] }) }));
      }
      if (type === 'items') {
        let mediaId = form.mediaId || null;
        let imageUrl = form.imageUrl || null;
        if (form.imageFile) {
          const uploaded = await adminApi.uploadMedia(form.imageFile, 'menu');
          uploadedMediaIds.push(uploaded.id);
          mediaId = uploaded.id;
          imageUrl = uploaded.url;
        }
        let tags = null;
        if (form.tagsText.trim()) {
          try { tags = JSON.parse(form.tagsText); } catch { throw new Error('標籤 JSON 格式不正確。'); }
        }
        saved = await adminApi.saveMenuItem(localId(form.id), { categoryId: form.categoryId, itemName: form.itemName, itemDescription: form.itemDescription || null, price: Number(form.price) || 0, mediaId, imageUrl, tags, sortOrder: Number(form.sortOrder) || 0, isAvailable: form.isAvailable });
        setMenu((current) => ({ ...current, categories: current.categories.map((category) => ({ ...category, items: category.items.filter((item) => item.id !== form.id && item.id !== saved.id).concat(category.id === saved.categoryId ? [saved] : []) })) }));
      }
      if (type === 'sets') {
        let mediaId = form.mediaId || null;
        let imageUrl = form.imageUrl || null;
        if (form.imageFile) {
          const uploaded = await adminApi.uploadMedia(form.imageFile, 'menu');
          uploadedMediaIds.push(uploaded.id);
          mediaId = uploaded.id;
          imageUrl = uploaded.url;
        }
        saved = await adminApi.saveMenuSet(localId(form.id), { setName: form.setName, setDescription: form.setDescription || null, setPrice: Number(form.setPrice) || 0, mediaId, imageUrl, sortOrder: Number(form.sortOrder) || 0, isAvailable: form.isAvailable, items: form.items.map((item, index) => ({ id: localId(item.id), menuItemId: item.menuItemId, itemRole: item.itemRole, quantity: Number(item.quantity) || 1, sortOrder: index })) });
        setMenu((current) => ({ ...current, sets: upsert(current.sets, saved) }));
      }
      setEditing(null);
      setMessage('菜單資料已儲存。');
    } catch (error) {
      await cleanupAdminMedia(uploadedMediaIds);
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveOrder = async () => {
    if (!orderDirty) return;
    setSaving(true);
    try {
      for (const rule of menu.pricingRules.filter((item) => !item.id.startsWith('local-'))) await adminApi.savePricingRule(rule.id, { title: rule.title, description: rule.description, priceText: rule.priceText || null, sortOrder: Number(rule.sortOrder) || 0, isEnabled: rule.isEnabled });
      for (const category of menu.categories.filter((item) => !item.id.startsWith('local-'))) {
        await adminApi.saveMenuCategory(category.id, { categoryName: category.categoryName, categoryDescription: category.categoryDescription || null, sortOrder: Number(category.sortOrder) || 0, isEnabled: category.isEnabled });
        for (const item of (category.items || []).filter((value) => !value.id.startsWith('local-'))) await adminApi.saveMenuItem(item.id, { categoryId: item.categoryId, itemName: item.itemName, itemDescription: item.itemDescription || null, price: Number(item.price) || 0, mediaId: item.mediaId || null, imageUrl: item.imageUrl || null, tags: item.tags || null, sortOrder: Number(item.sortOrder) || 0, isAvailable: item.isAvailable });
      }
      for (const set of menu.sets.filter((item) => !item.id.startsWith('local-'))) await adminApi.saveMenuSet(set.id, { setName: set.setName, setDescription: set.setDescription || null, setPrice: Number(set.setPrice) || 0, mediaId: set.mediaId || null, imageUrl: set.imageUrl || null, sortOrder: Number(set.sortOrder) || 0, isAvailable: set.isAvailable, items: (set.items || []).map((item, index) => ({ id: localId(item.id), menuItemId: item.menuItemId, itemRole: item.itemRole, quantity: Number(item.quantity) || 1, sortOrder: index })) });
      setOrderDirty(false);
      setMessage('菜單排序已儲存。');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing?.form.id || !window.confirm('確定刪除這筆資料？')) return;
    const { type, form } = editing;
    try {
      if (type === 'pricing' && !form.id.startsWith('local-')) await adminApi.deletePricingRule(form.id);
      if (type === 'categories' && !form.id.startsWith('local-')) await adminApi.deleteMenuCategory(form.id);
      if (type === 'items' && !form.id.startsWith('local-')) await adminApi.deleteMenuItem(form.id);
      if (type === 'sets' && !form.id.startsWith('local-')) await adminApi.deleteMenuSet(form.id);
      if (type === 'pricing') setMenu((current) => ({ ...current, pricingRules: current.pricingRules.filter((item) => item.id !== form.id).map((item, index) => ({ ...item, sortOrder: index })) }));
      if (type === 'categories') setMenu((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== form.id).map((item, index) => ({ ...item, sortOrder: index })) }));
      if (type === 'items') setMenu((current) => ({ ...current, categories: current.categories.map((category) => ({ ...category, items: category.items.filter((item) => item.id !== form.id).map((item, index) => ({ ...item, sortOrder: index })) })) }));
      if (type === 'sets') setMenu((current) => ({ ...current, sets: current.sets.filter((item) => item.id !== form.id).map((item, index) => ({ ...item, sortOrder: index })) }));
      setEditing(null);
      setMessage('資料已刪除。');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const renderCards = () => {
    if (tab === 'items') return <div className="adminMenuGroupedList">{menu.categories.map((category) => <AdminPanel key={category.id} title={category.categoryName} description="拖曳品項卡片調整此分類內的順序。"><AdminDragList items={category.items || []} onReorder={(items) => updateCategoryItems(category.id, items)} onItemClick={(item) => openEdit('items', item)} renderItem={(item) => <><div className="adminDragCardWithImage">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<div><strong>{item.itemName || '未命名品項'}</strong><small>{item.price} Gil · {item.itemDescription || '沒有描述'}</small></div></div><div className="adminDragCardMeta"><em>{item.isAvailable ? '供應中' : '停售'}</em></div></>} emptyText="此分類尚無品項。" /></AdminPanel>)}</div>;
    const collection = tab === 'pricing' ? menu.pricingRules : tab === 'categories' ? menu.categories : menu.sets;
    return <AdminDragList items={collection} onReorder={(items) => { const key = tab === 'pricing' ? 'pricingRules' : tab; setMenu((current) => ({ ...current, [key]: items })); setOrderDirty(true); }} onItemClick={(item) => openEdit(tab, item)} renderItem={(item) => <><div className="adminDragCardWithImage">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<div><strong>{displayName(tab, item) || '未命名資料'}</strong><small>{secondaryName(tab, item)}</small></div></div><div className="adminDragCardMeta"><em>{displayEnabled(tab, item)}</em></div></>} emptyText="尚無資料，請新增第一筆。" />;
  };

  const currentLabel = tabs.find(([id]) => id === tab)?.[1] || '';
  return (
    <AdminPage eyebrow="Dream Menu" title="菜單設定" description="管理消費規則、菜單分類、餐點品項與套餐組合。所有排序統一使用拖曳卡片，點擊卡片開啟編輯。" actions={<><AdminButton variant="secondary" onClick={create}>新增{currentLabel}</AdminButton><AdminButton onClick={saveOrder} disabled={!orderDirty || saving}>{saving ? '儲存中…' : '儲存排序'}</AdminButton></>}>
      {message ? <div className="adminNotice">{message}</div> : null}
      <div className="adminTabs">{tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? 'isActive' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
      <AdminState loading={state.loading} error={state.error} onRetry={load} />
      {!state.loading && !state.error ? <AdminPanel title={currentLabel}>{renderCards()}</AdminPanel> : null}

      <AdminDialog open={Boolean(editing)} title={editing ? `${editing.form.id.startsWith('local-') ? '新增' : '編輯'}${tabs.find(([id]) => id === editing.type)?.[1]}` : ''} description="排序請回到卡片清單拖曳調整。" onClose={() => setEditing(null)} actions={<><AdminButton variant="danger" onClick={remove}>刪除</AdminButton><span className="adminDialogActionSpacer" /><AdminButton variant="ghost" onClick={() => setEditing(null)}>取消</AdminButton><AdminButton onClick={saveEditing} disabled={saving}>{saving ? '儲存中…' : '儲存資料'}</AdminButton></>}>
        {editing?.type === 'pricing' ? <PricingForm form={editing.form} update={updateEditing} /> : null}
        {editing?.type === 'categories' ? <CategoryForm form={editing.form} update={updateEditing} /> : null}
        {editing?.type === 'items' ? <ItemForm form={editing.form} update={updateEditing} categories={menu.categories} /> : null}
        {editing?.type === 'sets' ? <SetForm form={editing.form} update={updateEditing} items={allItems} /> : null}
      </AdminDialog>
    </AdminPage>
  );
}

function PricingForm({ form, update }) {
  return <div className="adminFormGrid"><AdminField label="標題"><input value={form.title} onChange={(event) => update('title', event.target.value)} autoFocus /></AdminField><AdminField label="價格文字"><input value={form.priceText || ''} onChange={(event) => update('priceText', event.target.value)} /></AdminField><AdminField label="說明" className="span-2"><textarea rows="6" value={form.description} onChange={(event) => update('description', event.target.value)} /></AdminField><AdminToggle checked={form.isEnabled} onChange={(value) => update('isEnabled', value)} /></div>;
}

function CategoryForm({ form, update }) {
  return <div className="adminFormGrid"><AdminField label="分類名稱"><input value={form.categoryName} onChange={(event) => update('categoryName', event.target.value)} autoFocus /></AdminField><AdminField label="分類說明" className="span-2"><textarea rows="5" value={form.categoryDescription || ''} onChange={(event) => update('categoryDescription', event.target.value)} /></AdminField><AdminToggle checked={form.isEnabled} onChange={(value) => update('isEnabled', value)} /></div>;
}

function ItemForm({ form, update, categories }) {
  return <div className="adminFormGrid"><AdminField label="所屬分類"><select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.categoryName}</option>)}</select></AdminField><AdminField label="品項名稱"><input value={form.itemName} onChange={(event) => update('itemName', event.target.value)} autoFocus /></AdminField><AdminField label="價格"><input type="number" min="0" value={form.price} onChange={(event) => update('price', event.target.value)} /></AdminField><AdminField label="品項描述" className="span-2"><textarea rows="5" value={form.itemDescription || ''} onChange={(event) => update('itemDescription', event.target.value)} /></AdminField><AdminField label="標籤 JSON" className="span-2" hint={'例如：["人氣","推薦"]'}><input value={form.tagsText} onChange={(event) => update('tagsText', event.target.value)} /></AdminField><AdminImagePicker label="餐點圖片" value={form.imageUrl} pendingFile={form.imageFile} onChange={(file) => update('imageFile', file)} onClear={() => { update('imageFile', null); update('imageUrl', ''); update('mediaId', null); }} /><div className="adminFormWide"><AdminToggle checked={form.isAvailable} onChange={(value) => update('isAvailable', value)} label="目前供應" /></div></div>;
}

function SetForm({ form, update, items }) {
  const [editingItem, setEditingItem] = useState(null);
  const updateItem = (id, key, value) => update('items', form.items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  const saveItem = () => { update('items', form.items.map((item) => item.id === editingItem.id ? editingItem : item)); setEditingItem(null); };
  return <><div className="adminFormGrid"><AdminField label="套餐名稱"><input value={form.setName} onChange={(event) => update('setName', event.target.value)} autoFocus /></AdminField><AdminField label="套餐價格"><input type="number" min="0" value={form.setPrice} onChange={(event) => update('setPrice', event.target.value)} /></AdminField><AdminField label="套餐描述" className="span-2"><textarea rows="5" value={form.setDescription || ''} onChange={(event) => update('setDescription', event.target.value)} /></AdminField><AdminImagePicker label="套餐圖片" value={form.imageUrl} pendingFile={form.imageFile} onChange={(file) => update('imageFile', file)} onClear={() => { update('imageFile', null); update('imageUrl', ''); update('mediaId', null); }} /><div><AdminToggle checked={form.isAvailable} onChange={(value) => update('isAvailable', value)} label="目前供應" /><p className="adminFieldHint">套餐內容排序請拖曳卡片。</p></div><div className="adminFormWide adminSetItems"><div className="adminSubheading"><strong>套餐內容</strong><AdminButton variant="secondary" onClick={() => { const item = { id: newId(), menuItemId: items[0]?.id || '', itemName: '', itemRole: 'main', quantity: 1, sortOrder: form.items.length }; update('items', [...form.items, item]); setEditingItem(item); }}>新增餐點</AdminButton></div><AdminDragList items={form.items} onReorder={(next) => update('items', next)} onItemClick={(item) => setEditingItem({ ...item })} renderItem={(item) => <><div><strong>{item.itemName || items.find((value) => value.id === item.menuItemId)?.itemName || '未選餐點'}</strong><small>{item.itemRole} · 數量 {item.quantity}</small></div><div className="adminDragCardMeta"><AdminButton variant="danger" onClick={(event) => { event.stopPropagation(); update('items', form.items.filter((value) => value.id !== item.id)); }}>移除</AdminButton></div></>} emptyText="尚無套餐內容。" /></div></div><AdminDialog open={Boolean(editingItem)} title="編輯套餐內容" onClose={() => setEditingItem(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingItem(null)}>取消</AdminButton><AdminButton onClick={saveItem}>完成編輯</AdminButton></>}><div className="adminFormGrid"><AdminField label="餐點"><select value={editingItem?.menuItemId || ''} onChange={(event) => setEditingItem((current) => ({ ...current, menuItemId: event.target.value }))}>{items.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}</select></AdminField><AdminField label="角色"><select value={editingItem?.itemRole || 'main'} onChange={(event) => setEditingItem((current) => ({ ...current, itemRole: event.target.value }))}><option value="main">主餐</option><option value="dessert">甜點</option><option value="drink">飲品</option></select></AdminField><AdminField label="數量"><input type="number" min="1" value={editingItem?.quantity || 1} onChange={(event) => setEditingItem((current) => ({ ...current, quantity: event.target.value }))} /></AdminField></div></AdminDialog></>;
}

function localId(id) { return id && !id.startsWith('local-') ? id : null; }
function upsert(items, value) { return items.some((item) => item.id === value.id) ? items.map((item) => item.id === value.id ? value : item) : [...items, value]; }
function toForm(type, value) {
  if (type === 'pricing') return value ? { ...value } : { ...emptyPricing };
  if (type === 'categories') return value ? { ...value } : { ...emptyCategory };
  if (type === 'items') return value ? { ...value, imageFile: null, tagsText: value.tags ? JSON.stringify(value.tags) : '' } : { ...emptyItem };
  return value ? { ...value, imageFile: null, items: (value.items || []).map((item) => ({ ...item })) } : { ...emptySet };
}
function displayName(tab, item) { return tab === 'pricing' ? item.title : tab === 'categories' ? item.categoryName : tab === 'items' ? item.itemName : item.setName; }
function secondaryName(tab, item) { return tab === 'pricing' ? item.priceText || item.description : tab === 'categories' ? item.categoryDescription || '分類' : tab === 'items' ? `${item.price} Gil` : `${item.setPrice} Gil`; }
function displayEnabled(tab, item) { return (tab === 'categories' ? item.isEnabled : tab === 'items' || tab === 'sets' ? item.isAvailable : item.isEnabled) ? '啟用' : '停用'; }
