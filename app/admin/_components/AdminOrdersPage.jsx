import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../admin-api.js';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton } from './AdminShared.jsx';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (value) => `${Number(value || 0).toLocaleString('zh-TW')} G`;
const labels = { submitted: '等待確認', partially_confirmed: '部分確認', needs_reschedule: '需重新排程', confirmed: '已成立', in_service: '服務中', completed: '已完成', cancelled: '已取消', expired: '已失效', rejected: '已退回' };
const editableStatuses = ['submitted', 'needs_reschedule', 'confirmed', 'in_service', 'completed', 'rejected', 'cancelled'];

function localDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdminOrdersPage() {
  const { user } = useAdminAuth();
  const canManage = user.role === 'developer' || user.role === 'manager';
  const [businessDate, setBusinessDate] = useState(today);
  const [search, setSearch] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', error: false });
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState({ attention: true, others: true });
  const [issued, setIssued] = useState(null);

  const loadSessions = async (preferredId) => {
    setLoading(true);
    try {
      const data = await adminApi.getOrderSessions({ businessDate, search: search.trim() });
      setSessions(data || []);
      const nextId = preferredId || (data || []).find((item) => item.session.id === selectedId)?.session.id || data?.[0]?.session.id || '';
      setSelectedId(nextId);
      setOrders(nextId ? await adminApi.getSessionOrders(nextId) : []);
      setMessage({ text: '', error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSessions(); }, [businessDate]);
  useEffect(() => { if (canManage) adminApi.getOrderingSettings().then(setSettings).catch(() => {}); }, [canManage]);

  const selected = sessions.find((item) => item.session.id === selectedId);
  const groups = useMemo(() => ({
    attention: sessions.filter((item) => item.waitingOrderCount > 0),
    others: sessions.filter((item) => item.waitingOrderCount === 0),
  }), [sessions]);

  const selectSession = async (id) => {
    setSelectedId(id); setLoading(true);
    try { setOrders(await adminApi.getSessionOrders(id)); }
    catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setLoading(false); }
  };

  const refreshSelected = async () => {
    if (!selectedId) return;
    setOrders(await adminApi.getSessionOrders(selectedId));
    await loadSessions(selectedId);
  };

  const act = async (action, success) => {
    setLoading(true);
    try { await action(); setMessage({ text: success, error: false }); await refreshSelected(); }
    catch (error) { setMessage({ text: error.message, error: true }); setLoading(false); }
  };

  return <section className="adminPage adminOrdersPage">
    <header className="adminPageHeading"><div><p className="eyebrow">ORDER CONTROL</p><h1>點單管理</h1><p>左側以搜尋與待處理分組收納大量顧客；右側集中顯示該顧客今天的全部訂單。</p></div><div className="adminPageActions"><AdminButton variant="secondary" onClick={() => loadSessions(selectedId)}>重新整理</AdminButton>{canManage ? <AdminButton variant="ghost" onClick={() => setShowSettings(!showSettings)}>營運參數</AdminButton> : null}<AdminButton onClick={() => setShowCreate(!showCreate)}>＋ 開立點餐碼</AdminButton></div></header>
    {message.text ? <div className={message.error ? 'adminOrderMessage isError' : 'adminOrderMessage'} role="status">{message.text}<button onClick={() => setMessage({ text: '', error: false })}>×</button></div> : null}
    {showCreate ? <CreateSessionPanel onClose={() => setShowCreate(false)} onIssued={(result) => { setIssued(result); setShowCreate(false); loadSessions(result.session.id); }} /> : null}
    {issued ? <IssuedPanel issued={issued} onClose={() => setIssued(null)} /> : null}
    {canManage && showSettings && settings ? <SettingsPanel settings={settings} onSaved={(value) => { setSettings(value); setMessage({ text: '營運參數已更新。', error: false }); }} /> : null}
    <div className="adminOrderWorkspace">
      <aside className="adminCustomerPane">
        <div className="adminCustomerToolbar"><label>營業日<input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /></label><form onSubmit={(event) => { event.preventDefault(); loadSessions(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋顧客名稱或遊戲 ID" /><button type="submit">搜尋</button></form><div><span>今日顧客</span><strong>{sessions.length}</strong></div></div>
        <CustomerGroup title="待處理" count={groups.attention.length} open={groupsOpen.attention} onToggle={() => setGroupsOpen((current) => ({ ...current, attention: !current.attention }))}>{groups.attention.map((item) => <CustomerRow key={item.session.id} item={item} active={item.session.id === selectedId} onClick={() => selectSession(item.session.id)} />)}</CustomerGroup>
        <CustomerGroup title="其他顧客" count={groups.others.length} open={groupsOpen.others} onToggle={() => setGroupsOpen((current) => ({ ...current, others: !current.others }))}>{groups.others.map((item) => <CustomerRow key={item.session.id} item={item} active={item.session.id === selectedId} onClick={() => selectSession(item.session.id)} />)}</CustomerGroup>
      </aside>
      <div className="adminOrderDetailPane">
        {!selected ? <div className="adminOrderEmpty"><span>LD</span><h2>選擇一位顧客</h2><p>使用左側搜尋或分組快速定位顧客。</p></div> : <>
          <SessionHeader item={selected} loading={loading} onUpdate={(body) => act(() => adminApi.updateOrderSession(selectedId, body), '顧客點餐設定已更新。')} onReissue={async () => { try { setIssued(await adminApi.reissueOrderSession(selectedId)); } catch (error) { setMessage({ text: error.message, error: true }); } }} />
          <div className="adminOrderCards">{orders.length ? orders.map((order) => <AdminOrderCard key={order.id} order={order} user={user} loading={loading} act={act} />) : <div className="adminOrderEmpty isCompact"><h2>尚未下單</h2><p>此點餐碼今天還沒有送出訂單。</p></div>}</div>
        </>}
      </div>
    </div>
  </section>;
}

function CustomerGroup({ title, count, open, onToggle, children }) {
  return <section className="adminCustomerGroup"><button type="button" onClick={onToggle}><span>{open ? '−' : '+'} {title}</span><b>{count}</b></button>{open ? <div>{children.length ? children : <p>沒有顧客</p>}</div> : null}</section>;
}
function CustomerRow({ item, active, onClick }) {
  return <button type="button" className={`adminCustomerRow ${active ? 'isActive' : ''}`} onClick={onClick}><span className="adminCustomerInitial">{item.session.customerName.slice(0, 1)}</span><span><strong>{item.session.customerName}</strong><small>ID {item.session.gameId}</small></span><span><b>{item.waitingOrderCount ? `${item.waitingOrderCount} 待處理` : `${item.orderCount} 單`}</b><small>{money(item.totalAmount)}</small></span></button>;
}

function SessionHeader({ item, onUpdate, onReissue, loading }) {
  const [max, setMax] = useState(item.session.maxNominatedStaff);
  useEffect(() => setMax(item.session.maxNominatedStaff), [item.session.maxNominatedStaff]);
  return <header className="adminSelectedCustomer"><div><span>SELECTED CUSTOMER</span><h2>{item.session.customerName}</h2><p>遊戲 ID：{item.session.gameId} · 今日共 {item.orderCount} 張訂單</p></div><dl><div><dt>信物餐點餘額</dt><dd>{money(item.session.remainingMealCredit)}</dd></div><div><dt>今日消費</dt><dd>{money(item.totalAmount)}</dd></div></dl><div className="adminSessionControls"><label>同時可指名人數<input type="number" min="0" max="100" value={max} onChange={(event) => setMax(Number(event.target.value))} /></label><AdminButton variant="secondary" disabled={loading} onClick={() => onUpdate({ maxNominatedStaff: max })}>儲存人數</AdminButton><AdminButton variant="ghost" disabled={loading} onClick={onReissue}>尋回／重發點餐碼</AdminButton></div></header>;
}

function AdminOrderCard({ order, user, loading, act }) {
  const [open, setOpen] = useState(order.status === 'submitted' || order.status === 'needs_reschedule');
  const [note, setNote] = useState(order.internalNote || '');
  const [status, setStatus] = useState(order.status);
  const [startsAt, setStartsAt] = useState(localDateTimeValue(order.nominees?.[0]?.requestedStartsAt));
  const mineWaiting = order.nominees?.some((item) => item.staffId === user.staffMemberId && item.confirmationStatus === 'waiting');
  const cancelable = ['submitted', 'partially_confirmed', 'needs_reschedule'].includes(order.status);
  return <article className={`adminOrderCard is-${order.status}`}><button type="button" className="adminOrderCardHead" onClick={() => setOpen(!open)}><div><span>{order.orderNumber}</span><strong>{labels[order.status] || order.status}</strong><small>{order.queueStage}{order.queueMinutes ? ` · ${order.queueMinutes} 分鐘` : ''}</small></div><div><span>{new Date(order.submittedAt).toLocaleString('zh-TW')}</span><b>{money(order.totalAmount)}</b></div></button>{open ? <div className="adminOrderCardBody">
    <div className="adminOrderItemList">{order.items.map((item) => <div key={item.id}><span><small>{item.itemType}</small><strong>{item.name}</strong></span><b>{money(item.lineTotal)}</b><button type="button" disabled={loading} onClick={() => act(() => adminApi.deleteOrderItem(order.id, item.id), '訂單項目已刪除。')}>快速刪除</button></div>)}</div>
    {order.nominees?.length ? <div className="adminNomineeGrid">{order.nominees.map((item) => <article key={item.id}><span>{item.confirmationStatus}</span><strong>{item.staffName}</strong><p>{item.serviceName} · {item.segmentCount} 節</p><small>{new Date(item.requestedStartsAt).toLocaleString('zh-TW')} ～ {new Date(item.busyUntil).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</small></article>)}</div> : null}
    {mineWaiting ? <AdminButton disabled={loading} onClick={() => act(() => adminApi.confirmNominee(order.id), '已確認自己的指名；多人訂單會等待其他被指名店員。')}>確認我的指名</AdminButton> : null}
    {order.status === 'needs_reschedule' || order.status === 'submitted' ? <div className="adminOrderReschedule"><label>重新安排開始時間<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><AdminButton variant="secondary" disabled={!startsAt || loading} onClick={() => act(() => adminApi.rescheduleOrder(order.id, new Date(startsAt).toISOString()), '已重新排程並退回等待確認。')}>重新排程</AdminButton></div> : null}
    <div className="adminOrderEmergency"><label>內部備註<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><label>緊急狀態<select value={status} onChange={(event) => setStatus(event.target.value)}>{editableStatuses.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label><AdminButton variant="secondary" disabled={loading} onClick={() => act(() => adminApi.updateOrder(order.id, { internalNote: note, status }), '訂單內容與狀態已更新並留下稽核紀錄。')}>儲存緊急調整</AdminButton>{cancelable ? <AdminButton variant="danger" disabled={loading} onClick={() => act(() => adminApi.cancelOrder(order.id, '後台刪除未執行訂單'), '未執行訂單已取消，餐點信物折抵已退回。')}>刪除未執行訂單</AdminButton> : null}</div>
    <div className="adminOrderTotals"><span>小計 {money(order.subtotal)}</span><span>信物折抵 −{money(order.mealCreditApplied)}</span><strong>應付 {money(order.totalAmount)}</strong></div>
  </div> : null}</article>;
}

function CreateSessionPanel({ onClose, onIssued }) {
  const [form, setForm] = useState({ gameId: '', customerName: '', maxNominatedStaff: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => { event.preventDefault(); setLoading(true); try { onIssued(await adminApi.createOrderSession({ ...form, customerName: form.customerName || null })); } catch (reason) { setError(reason.message); setLoading(false); } };
  return <div className="adminOrderInlinePanel"><header><div><span>NEW ORDER PASS</span><h2>開立今日點餐碼</h2></div><button onClick={onClose}>×</button></header><form onSubmit={submit}><label>顧客遊戲 ID<input value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value })} required /></label><label>顧客顯示名稱（選填）<input value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label><label>可同時指名人數<input type="number" min="0" max="100" value={form.maxNominatedStaff} onChange={(event) => setForm({ ...form, maxNominatedStaff: Number(event.target.value) })} /></label><AdminButton type="submit" disabled={loading}>{loading ? '開立中…' : '產生點餐網址'}</AdminButton></form>{error ? <p className="adminFormError">{error}</p> : null}</div>;
}

function IssuedPanel({ issued, onClose }) {
  const copy = (value) => navigator.clipboard?.writeText(value);
  return <div className="adminIssuedPanel"><header><div><span>ORDER PASS READY</span><h2>{issued.session.customerName} 的今日點餐資料</h2></div><button onClick={onClose}>×</button></header><div><label>點餐網址<code>{issued.orderUrl}</code><button onClick={() => copy(issued.orderUrl)}>複製網址</button></label><label>六位數協助碼<code>{issued.recoveryCode}</code><button onClick={() => copy(issued.recoveryCode)}>複製協助碼</button></label></div><p>重新補發會使舊網址失效；協助碼只在顧客遺失點餐碼時由店員提供。</p></div>;
}

function SettingsPanel({ settings, onSaved }) {
  const [form, setForm] = useState(settings);
  const [pause, setPause] = useState(30);
  const save = async () => onSaved(await adminApi.saveOrderingSettings({ minimumMealCredit: form.minimumMealCredit, baseNominationFee: form.baseNominationFee, segmentMinutes: form.segmentMinutes, reminderAfterMinutes: form.reminderAfterMinutes, escalateAfterMinutes: form.escalateAfterMinutes, expireAfterMinutes: form.expireAfterMinutes }));
  const pauseNow = async () => onSaved(await adminApi.pauseNomination(pause));
  return <div className="adminOrderingSettings"><header><div><span>MANAGER / DEVELOPER</span><h2>點餐營運參數</h2><p>價格變更只影響新訂單；既有訂單保留送出時快照。</p></div><AdminButton onClick={save}>儲存參數</AdminButton></header><div className="adminOrderingSettingsGrid"><label>低消／信物可折抵金額<input type="number" min="0" value={form.minimumMealCredit} onChange={(event) => setForm({ ...form, minimumMealCredit: Number(event.target.value) })} /></label><label>每節基礎指名費<input type="number" min="0" value={form.baseNominationFee} onChange={(event) => setForm({ ...form, baseNominationFee: Number(event.target.value) })} /></label><label>每節分鐘<input type="number" min="1" value={form.segmentMinutes} onChange={(event) => setForm({ ...form, segmentMinutes: Number(event.target.value) })} /></label><label>提醒（分鐘）<input type="number" min="1" value={form.reminderAfterMinutes} onChange={(event) => setForm({ ...form, reminderAfterMinutes: Number(event.target.value) })} /></label><label>升級（分鐘）<input type="number" min="1" value={form.escalateAfterMinutes} onChange={(event) => setForm({ ...form, escalateAfterMinutes: Number(event.target.value) })} /></label><label>失效（分鐘）<input type="number" min="1" value={form.expireAfterMinutes} onChange={(event) => setForm({ ...form, expireAfterMinutes: Number(event.target.value) })} /></label></div><div className="adminNominationPause"><label>暫停指名分鐘<input type="number" min="0" max="1440" value={pause} onChange={(event) => setPause(Number(event.target.value))} /></label><AdminButton variant="secondary" onClick={pauseNow}>{pause === 0 ? '立即解除暫停' : `暫停 ${pause} 分鐘`}</AdminButton><span>{settings.nominationPaused ? `目前暫停至 ${new Date(settings.nominationPausedUntil).toLocaleString('zh-TW')}` : '目前開放指名'}</span></div></div>;
}
