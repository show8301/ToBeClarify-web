import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../admin-api.js';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton } from './AdminShared.jsx';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (value) => `${Number(value || 0).toLocaleString('zh-TW')} G`;
const defaultTipPresetAmounts = [50, 100, 200, 500];
const normalizeTipPresetAmounts = (values) => {
  const next = Array.isArray(values) ? values.map(Number) : [];
  return next.length === 4 && next.every((value) => Number.isFinite(value) && value > 0) ? next : defaultTipPresetAmounts;
};
const labels = { waiting: '等待確認', submitted: '等待確認', partially_confirmed: '部分確認', needs_reschedule: '需重新排程', confirmed: '已成立', in_service: '服務中', completed: '已完成', cancelled: '已取消', expired: '已失效', rejected: '已退回' };
const transitionLabels = { start: '開始服務', complete: '完成訂單', cancel: '取消訂單', reject: '退回訂單', return_to_reschedule: '退回重新排程' };

const minutesToTime = (value) => `${String(Math.floor(Number(value || 0) / 60)).padStart(2, '0')}:${String(Number(value || 0) % 60).padStart(2, '0')}`;
const timeToMinutes = (value) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; };

function localDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const localDateTimeNow = () => localDateTimeValue(new Date().toISOString());

export function AdminOrdersPage() {
  const { user } = useAdminAuth();
  const canManage = user.role === 'developer' || user.role === 'manager';
  const [businessDate, setBusinessDate] = useState(today);
  const [search, setSearch] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [businessContext, setBusinessContext] = useState(null);
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
  useEffect(() => { adminApi.getOrderingContext().then((value) => { setBusinessContext(value); setBusinessDate(value.referenceBusinessDate); }).catch(() => {}); }, []);
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
        <div className="adminCustomerToolbar"><label>營業日<input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /></label>{businessContext ? <p className={businessContext.orderingOpen ? 'adminBusinessPeriod isOpen' : 'adminBusinessPeriod'}><strong>{businessContext.orderingOpen ? '目前營業中' : '目前非營業時段'}</strong><span>{new Date(businessContext.referenceStartsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ～ {new Date(businessContext.referenceEndsAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></p> : null}<form onSubmit={(event) => { event.preventDefault(); loadSessions(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋顧客名稱或遊戲 ID" /><button type="submit">搜尋</button></form><div><span>本營業日顧客</span><strong>{sessions.length}</strong></div></div>
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
  const [open, setOpen] = useState(order.status === 'submitted' || order.status === 'needs_reschedule' || order.status === 'expired');
  const [note, setNote] = useState(order.internalNote || '');
  const [transitionReason, setTransitionReason] = useState('');
  const [startsAt, setStartsAt] = useState(localDateTimeValue(order.nominees?.[0]?.requestedStartsAt));
  const [backfillMode, setBackfillMode] = useState('');
  const [backfillStartsAt, setBackfillStartsAt] = useState(localDateTimeValue(order.startedAt) || localDateTimeValue(order.nominees?.[0]?.requestedStartsAt));
  const [backfillEndsAt, setBackfillEndsAt] = useState(localDateTimeValue(order.completedAt) || localDateTimeNow());
  const [backfillReason, setBackfillReason] = useState('');
  const mineWaiting = order.nominees?.some((item) => item.staffId === user.staffMemberId && item.confirmationStatus === 'waiting');
  const mineWaitingAddon = order.addons?.some((item) => item.staffId === user.staffMemberId && item.status === 'waiting');
  const canManageAddons = user.role === 'developer' || user.role === 'manager';
  const canBackfill = order.status === 'expired' && order.orderKind !== 'service_addon' && order.nominees?.length > 0 &&
    (canManageAddons || (order.nominees.length === 1 && order.nominees[0].staffId === user.staffMemberId));
  const cancelable = ['submitted', 'partially_confirmed', 'needs_reschedule'].includes(order.status);
  const transitions = order.status === 'confirmed' ? (order.orderKind === 'service_addon' ? ['start', 'cancel'] : ['start', 'return_to_reschedule', 'cancel']) : order.status === 'in_service' ? ['complete'] : cancelable ? ['reject', 'cancel'] : [];
  const isEarlyCompletion = order.status === 'in_service' && order.nominees?.some((item) => new Date(item.requestedServiceEndsAt).getTime() > Date.now());
  return <article className={`adminOrderCard is-${order.status}`}><button type="button" className="adminOrderCardHead" onClick={() => setOpen(!open)}><div><span>{order.orderKind === 'service_addon' ? '附掛加購服務單' : order.orderNumber}</span><strong>{labels[order.status] || order.status}</strong><small>{order.queueStage}{order.queueMinutes ? ` · ${order.queueMinutes} 分鐘` : ''}</small></div><div><span>{new Date(order.submittedAt).toLocaleString('zh-TW')}</span><b>{money(order.totalAmount)}</b></div></button>{open ? <div className="adminOrderCardBody">
     <div className="adminOrderItemList">{order.items.map((item) => <AdminOrderItemRow key={item.id} orderId={order.id} item={item} loading={loading} act={act} />)}</div>
     {order.addons?.length ? <div className="adminAddonSummary">{order.addons.map((item) => <article key={item.id}><span>ADD-ON · {labels[item.status] || item.status}</span><strong>{item.staffName}｜{item.serviceName}</strong><small>{item.serviceDurationMinutes} 分鐘 · {item.participantCount} 人 · 附掛於既有指名，不新增基礎費與忙碌區段</small></article>)}</div> : null}
      {order.nominees?.length ? <div className="adminNomineeGrid">{order.nominees.map((item) => <article key={item.id}><span>{item.confirmationStatus}</span><strong>{item.staffName}</strong><p>{item.serviceName} · {item.segmentCount} 節</p><small>{new Date(item.requestedStartsAt).toLocaleString('zh-TW')} ～ {new Date(item.busyUntil).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</small><NominationShortenControl orderId={order.id} orderStatus={order.status} item={item} loading={loading} act={act} />{['confirmed', 'in_service'].includes(order.status) && new Date(item.requestedServiceEndsAt).getTime() > Date.now() && (item.staffId === user.staffMemberId || canManageAddons) ? <AdminAddonComposer nominee={item} loading={loading} act={act} /> : null}</article>)}</div> : null}
      {order.startedAt || order.completedAt ? <div className="adminOrderActualTimes"><span>實際開始：{order.startedAt ? new Date(order.startedAt).toLocaleString('zh-TW') : '—'}</span><span>實際結束：{order.completedAt ? new Date(order.completedAt).toLocaleString('zh-TW') : '服務中'}</span></div> : null}
      {mineWaiting ? <AdminButton disabled={loading} onClick={() => act(() => adminApi.confirmNominee(order.id), '已確認自己的指名；多人訂單會等待其他被指名店員。')}>確認我的指名</AdminButton> : null}
      {mineWaitingAddon ? <AdminButton disabled={loading} onClick={() => act(() => adminApi.confirmAddon(order.id), '已確認顧客送出的附掛加購服務單。')}>確認我的加購服務</AdminButton> : null}
    {order.status === 'expired' ? <>
      <div className="adminOrderReschedule"><label>重新安排開始時間（尚未接待）<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><small>此流程只適用於顧客尚未被接待；重新排程後會回到等待被指名店員確認，並重新計入原本的信物折抵。</small><AdminButton variant="secondary" disabled={!startsAt || loading} onClick={() => act(() => adminApi.rescheduleOrder(order.id, new Date(startsAt).toISOString()), '已重新排程，訂單已恢復等待確認。')}>重新排程（尚未接待）</AdminButton></div>
      {canBackfill ? <div className="adminOrderBackfill"><div><strong>已接待補登</strong><small>不重新排入等待佇列；實際完成的服務只留下歷史忙碌紀錄。</small></div><div className="adminOrderBackfillModes"><AdminButton variant={backfillMode === 'in_service' ? 'primary' : 'secondary'} disabled={loading} onClick={() => setBackfillMode('in_service')}>補登服務中</AdminButton><AdminButton variant={backfillMode === 'completed' ? 'primary' : 'secondary'} disabled={loading} onClick={() => setBackfillMode('completed')}>補登已完成</AdminButton></div>{backfillMode ? <div className="adminOrderBackfillForm"><label>實際開始時間<input type="datetime-local" value={backfillStartsAt} onChange={(event) => setBackfillStartsAt(event.target.value)} /></label>{backfillMode === 'completed' ? <label>實際結束時間<input type="datetime-local" value={backfillEndsAt} onChange={(event) => setBackfillEndsAt(event.target.value)} /></label> : <small>服務中會沿用原預約結束與休息時間；若原時段已結束，請改用補登已完成。</small>}<label>補登原因（必填）<input value={backfillReason} maxLength="500" placeholder="例如：已現場接待，店員忘記確認訂單" onChange={(event) => setBackfillReason(event.target.value)} /></label><AdminButton disabled={loading || !backfillStartsAt || !backfillReason.trim() || (backfillMode === 'completed' && !backfillEndsAt)} onClick={() => act(() => adminApi.backfillServedOrder(order.id, { status: backfillMode, actualStartsAt: new Date(backfillStartsAt).toISOString(), actualEndsAt: backfillMode === 'completed' ? new Date(backfillEndsAt).toISOString() : null, reason: backfillReason.trim() }), backfillMode === 'completed' ? '已補登已完成服務；已建立歷史忙碌紀錄。' : '已補登服務中；目前忙碌區段已同步。')}>{backfillMode === 'completed' ? '確認補登已完成' : '確認補登服務中'}</AdminButton></div> : null}</div> : <small className="adminOrderBackfillHint">多人失效訂單的已接待補登需由店經理或開發者執行。</small>}
    </> : ['needs_reschedule', 'submitted'].includes(order.status) ? <div className="adminOrderReschedule"><label>重新安排開始時間<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><AdminButton variant="secondary" disabled={!startsAt || loading} onClick={() => act(() => adminApi.rescheduleOrder(order.id, new Date(startsAt).toISOString()), '已重新排程並退回等待確認。')}>重新排程</AdminButton></div> : null}
    <div className="adminOrderEmergency"><label>內部備註<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><AdminButton variant="secondary" disabled={loading} onClick={() => act(() => adminApi.updateOrder(order.id, { internalNote: note }), '內部備註已儲存並留下稽核紀錄。')}>儲存備註</AdminButton></div>
    {transitions.length ? <div className="adminOrderTransitions"><label>狀態操作原因（取消／退回／提早完成必填）<input value={transitionReason} maxLength="500" placeholder="例如：顧客改期、雙方同意提早結束" onChange={(event) => setTransitionReason(event.target.value)} /></label>{isEarlyCompletion ? <p>目前早於預約結束時間；完成後會記為「實際提早完成」，釋放店員但不自動改價。</p> : null}<div>{transitions.map((value) => { const needsReason = value === 'cancel' || value === 'reject' || value === 'return_to_reschedule' || (value === 'complete' && isEarlyCompletion); const actionLabel = value === 'complete' && isEarlyCompletion ? '實際提早完成' : transitionLabels[value]; return <AdminButton key={value} variant={value === 'cancel' || value === 'reject' ? 'danger' : 'secondary'} disabled={loading || (needsReason && !transitionReason.trim())} onClick={() => act(() => adminApi.transitionOrder(order.id, value, transitionReason.trim()), `已執行「${actionLabel}」，忙碌區段與訂單狀態已同步。`)}>{actionLabel}</AdminButton>; })}</div></div> : null}
    <div className="adminOrderTotals"><span>小計 {money(order.subtotal)}</span><span>信物折抵 −{money(order.mealCreditApplied)}</span><strong>應付 {money(order.totalAmount)}</strong></div>
  </div> : null}</article>;
}

function AdminAddonComposer({ nominee, loading, act }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [segments, setSegments] = useState(1);
  const [participants, setParticipants] = useState(1);
  const service = options.find((item) => item.id === serviceId);
  const segmentMinutes = Number(nominee.segmentMinutes || 20);
  const effectiveStart = Math.max(Date.now(), new Date(nominee.requestedStartsAt).getTime());
  const remainingMinutes = Math.max(0, Math.floor((new Date(nominee.requestedServiceEndsAt).getTime() - effectiveStart) / 60_000));
  const minimumSegments = service?.durationMinutes ? Math.ceil(service.durationMinutes / segmentMinutes) : 1;
  const maxSegments = Math.max(0, Math.floor(remainingMinutes / segmentMinutes));
  const safeSegments = Math.max(minimumSegments, Math.min(segments, maxSegments || minimumSegments));
  const duration = service?.durationMinutes || safeSegments * segmentMinutes;
  const unit = service ? Number(service.price) + Math.max(0, participants - 1) * Number(service.additionalPersonPrice || 0) : 0;
  const total = service ? unit * (service.durationMinutes ? 1 : safeSegments) : 0;
  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (options.length) return;
    setFetching(true);
    try {
      const next = await adminApi.getAddonOptions(nominee.id);
      setOptions(next || []);
      setServiceId(next?.[0]?.id || '');
      setError('');
    } catch (reason) { setError(reason.message); }
    finally { setFetching(false); }
  };
  useEffect(() => { if (service) setSegments(service.durationMinutes ? Math.ceil(service.durationMinutes / segmentMinutes) : 1); }, [serviceId]);
  return <div className="adminAddonComposer"><button type="button" onClick={toggle}>{open ? '收起代客加購' : '＋ 代客加購服務'}</button>{open ? <div><p>剩餘約 {remainingMinutes} 分鐘。被指名者代客送出後直接成立，不再收基礎指名費，也不延長原時段。</p>{error ? <small className="adminFormError">{error}</small> : fetching ? <small>載入服務中…</small> : options.length ? <><label>服務<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{options.map((item) => <option key={item.id} value={item.id}>{item.serviceName}｜{money(item.price)}{item.durationMinutes ? `／${item.durationMinutes} 分鐘` : '／節'}</option>)}</select></label><div><label>節數<input type="number" min={minimumSegments} max={maxSegments} disabled={Boolean(service?.durationMinutes)} value={safeSegments} onChange={(event) => setSegments(Number(event.target.value))} /></label><label>人數<input type="number" min="1" max="20" value={participants} onChange={(event) => setParticipants(Number(event.target.value))} /></label></div>{service?.priceText ? <small>標示價格：{service.priceText}</small> : null}<footer><span>{duration} 分鐘</span><strong>{money(total)}</strong><button type="button" disabled={loading || !service || duration > remainingMinutes} onClick={() => act(() => adminApi.submitAdminAddon(nominee.id, { serviceId, segmentCount: safeSegments, participantCount: participants }), `已代客送出「${service?.serviceName}」並直接成立。`)}>選好並代客送單</button></footer></> : <small>沒有可附掛的服務。</small>}</div> : null}</div>;
}

function NominationShortenControl({ orderId, orderStatus, item, loading, act }) {
  const minimum = Number(item.minimumSegmentCount || 1);
  const canEditStatus = ['submitted', 'partially_confirmed', 'needs_reschedule', 'confirmed'].includes(orderStatus);
  const canShorten = canEditStatus && new Date(item.requestedStartsAt).getTime() > Date.now() && item.segmentCount > minimum;
  const [segments, setSegments] = useState(Math.max(minimum, item.segmentCount - 1));
  const [reason, setReason] = useState('');
  useEffect(() => { setSegments(Math.max(minimum, item.segmentCount - 1)); setReason(''); }, [item.id, item.segmentCount, minimum]);
  if (!canShorten) return <small className="adminNomineeLimit">{item.segmentCount <= minimum ? `已達服務最低 ${minimum} 節` : '開始後不可正式縮短'}</small>;
  return <div className="adminNomineeShorten"><label>正式縮短為<input type="number" min={minimum} max={item.segmentCount - 1} value={segments} onChange={(event) => setSegments(Number(event.target.value))} /> 節</label><input value={reason} maxLength="500" placeholder="縮短原因（必填）" onChange={(event) => setReason(event.target.value)} /><button type="button" disabled={loading || !reason.trim() || segments < minimum || segments >= item.segmentCount} onClick={() => act(() => adminApi.shortenNomination(orderId, item.id, segments, reason.trim()), `已由 ${item.segmentCount} 節正式縮短為 ${segments} 節；金額與忙碌區段已同步。`)}>確認縮短</button></div>;
}

function AdminOrderItemRow({ orderId, item, loading, act }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: item.name, unitPrice: Number(item.unitPrice), quantity: Number(item.quantity) });
  const locksQuantity = item.itemType === 'nomination_base' || item.itemType === 'staff_service';
  useEffect(() => setForm({ name: item.name, unitPrice: Number(item.unitPrice), quantity: Number(item.quantity) }), [item.id, item.name, item.unitPrice, item.quantity]);
  const save = () => act(
    () => adminApi.updateOrderItem(orderId, item.id, { name: form.name.trim(), unitPrice: Number(form.unitPrice), quantity: locksQuantity ? undefined : Number(form.quantity) }),
    '訂單項目已修改，金額已重新計算並留下稽核紀錄。',
  );
  return <div className={editing ? 'isEditing' : ''}>
    <span><small>{item.itemType}</small><strong>{item.name}</strong>{item.quantity > 1 ? <em>× {item.quantity}</em> : null}</span>
    <b>{money(item.lineTotal)}</b>
    <div className="adminOrderItemActions"><button type="button" disabled={loading} onClick={() => setEditing(!editing)}>{editing ? '收起編輯' : '修改'}</button><button type="button" disabled={loading} onClick={() => act(() => adminApi.deleteOrderItem(orderId, item.id), '訂單項目已刪除。')}>快速刪除</button></div>
    {editing ? <div className="adminOrderItemEditor">
      <label>品名<input value={form.name} maxLength="160" onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>單價<input type="number" min="0" max="1000000" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: Number(event.target.value) })} /></label>
      <label>數量<input type="number" min="1" max="99" value={form.quantity} disabled={locksQuantity} title={locksQuantity ? '既有指名不可直接延長，請另開新訂單。' : undefined} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /></label>
      <AdminButton variant="secondary" disabled={loading || !form.name.trim()} onClick={save}>儲存項目</AdminButton>
      {locksQuantity ? <small>既有指名不可修改節數；需要追加時數請另開新訂單。</small> : null}
    </div> : null}
  </div>;
}

function CreateSessionPanel({ onClose, onIssued }) {
  const [form, setForm] = useState({ gameId: '', customerName: '', maxNominatedStaff: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => { event.preventDefault(); setLoading(true); try { onIssued(await adminApi.createOrderSession({ ...form, customerName: form.customerName || null })); } catch (reason) { setError(reason.message); setLoading(false); } };
  return <div className="adminOrderInlinePanel"><header><div><span>NEW ORDER PASS</span><h2>開立今日點餐碼</h2></div><button onClick={onClose}>×</button></header><form onSubmit={submit}><label>顧客遊戲 ID<input value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value })} required /></label><label>顧客顯示名稱（選填）<input value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label><label>可同時指名人數<input type="number" min="0" max="100" value={form.maxNominatedStaff} onChange={(event) => setForm({ ...form, maxNominatedStaff: Number(event.target.value) })} /></label><AdminButton type="submit" disabled={loading}>{loading ? '開立中…' : '產生點餐網址'}</AdminButton></form>{error ? <p className="adminFormError">{error}</p> : null}</div>;
}

function IssuedPanel({ issued, onClose }) {
  const [copied, setCopied] = useState('');
  const copy = async (value, key) => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? '' : current), 1800);
    } catch { setCopied(''); }
  };
  const compactUrl = compactOrderUrl(issued.orderUrl);
  return <div className="adminIssuedPanel"><header><div><span>ORDER PASS READY</span><h2>{issued.session.customerName} 的今日點餐資料</h2></div><button type="button" aria-label="關閉點餐資料" onClick={onClose}>×</button></header><div className="adminIssuedFields"><div className="adminIssuedField adminIssuedUrlField"><div className="adminIssuedFieldLabel"><strong>點餐網址</strong><small>畫面顯示縮短版，複製會帶出完整網址</small></div><code title={issued.orderUrl}>{compactUrl}</code><button className="adminCopyIconButton" type="button" aria-label="複製完整點餐網址" title="複製完整點餐網址" onClick={() => copy(issued.orderUrl, 'url')}><CopyIcon />{copied === 'url' ? <span className="adminCopyStatus">已複製</span> : null}</button></div><div className="adminIssuedField adminRecoveryField"><div className="adminIssuedFieldLabel"><strong>六位數協助碼</strong><small>顧客遺失網址時提供</small></div><code>{issued.recoveryCode}</code><button className="adminCopyIconButton" type="button" aria-label="複製協助碼" title="複製協助碼" onClick={() => copy(issued.recoveryCode, 'recovery')}><CopyIcon />{copied === 'recovery' ? <span className="adminCopyStatus">已複製</span> : null}</button></div></div><p>重新補發會使舊網址失效；協助碼只在顧客遺失點餐碼時由店員提供。</p></div>;
}

function compactOrderUrl(value) {
  try {
    const url = new URL(value);
    const code = url.searchParams.get('code');
    if (!code) return value;
    return `${url.host}${url.pathname}?code=${code.slice(0, 10)}…`;
  } catch { return value; }
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
}

function SettingsPanel({ settings, onSaved }) {
  const [form, setForm] = useState(settings);
  const [pause, setPause] = useState(30);
  const [override, setOverride] = useState(null);
  const [overrideDate, setOverrideDate] = useState(today);
  const [overrideStart, setOverrideStart] = useState('12:00');
  const [overrideEnd, setOverrideEnd] = useState('02:00');
  const [overrideDuration, setOverrideDuration] = useState(60);
  const [overrideReason, setOverrideReason] = useState('營業日跨日測試');
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const tipPresetAmounts = normalizeTipPresetAmounts(form.tipPresetAmounts);

  useEffect(() => {
    let active = true;
    adminApi.getBusinessDayOverride().then((value) => {
      if (!active || !value) return;
      setOverride(value);
      setOverrideDate(value.businessDate || today());
      setOverrideStart(value.startsAt?.slice(11, 16) || '12:00');
      setOverrideEnd(value.endsAt?.slice(11, 16) || '02:00');
      setOverrideDuration(Math.max(1, Math.ceil((new Date(value.expiresAt).getTime() - Date.now()) / 60000)));
      setOverrideReason(value.reason || '營業日測試');
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const save = async () => onSaved(await adminApi.saveOrderingSettings({ minimumMealCredit: form.minimumMealCredit, baseNominationFee: form.baseNominationFee, tipPresetAmounts, segmentMinutes: form.segmentMinutes, reminderAfterMinutes: form.reminderAfterMinutes, escalateAfterMinutes: form.escalateAfterMinutes, expireAfterMinutes: form.expireAfterMinutes, businessDayStartMinute: form.businessDayStartMinute, businessDayEndMinute: form.businessDayEndMinute, businessDayEndsNextDay: form.businessDayEndsNextDay }));
  const pauseNow = async () => onSaved(await adminApi.pauseNomination(pause));
  const addDate = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  };
  const saveOverride = async () => {
    setOverrideBusy(true); setOverrideError(''); setOverrideMessage('');
    const endDate = overrideEnd <= overrideStart ? addDate(overrideDate) : overrideDate;
    try {
      const value = await adminApi.saveBusinessDayOverride({
        businessDate: overrideDate,
        startsAt: `${overrideDate}T${overrideStart}:00`,
        endsAt: `${endDate}T${overrideEnd}:00`,
        durationMinutes: Number(overrideDuration),
        reason: overrideReason.trim(),
      });
      setOverride(value);
      setOverrideMessage(`已啟用正式環境測試覆寫，${value.expiresAt ? `將於 ${new Date(value.expiresAt).toLocaleString('zh-TW')} 自動失效` : ''}`);
    } catch (error) { setOverrideError(error.message); }
    finally { setOverrideBusy(false); }
  };
  const disableOverride = async () => {
    setOverrideBusy(true); setOverrideError(''); setOverrideMessage('');
    try {
      await adminApi.disableBusinessDayOverride();
      setOverride(null);
      setOverrideMessage('已恢復正常營業日快照。');
    } catch (error) { setOverrideError(error.message); }
    finally { setOverrideBusy(false); }
  };

  return <div className="adminOrderingSettings">
    <header><div><span>MANAGER / DEVELOPER</span><h2>點餐營運參數</h2><p>價格與時間變更只影響新營業日／新訂單；既有訂單保留送出時快照。</p></div><AdminButton onClick={save}>儲存參數</AdminButton></header>
    <div className="adminBusinessHours"><label>營業開始<input type="time" value={minutesToTime(form.businessDayStartMinute)} onChange={(event) => setForm({ ...form, businessDayStartMinute: timeToMinutes(event.target.value) })} /></label><label>營業結束<input type="time" value={minutesToTime(form.businessDayEndMinute)} onChange={(event) => setForm({ ...form, businessDayEndMinute: timeToMinutes(event.target.value) })} /></label><label className="adminBusinessNextDay"><input type="checkbox" checked={form.businessDayEndsNextDay} onChange={(event) => setForm({ ...form, businessDayEndsNextDay: event.target.checked })} />結束時間屬於隔日</label><p>例如 18:00～隔日 03:00：凌晨 02:00 的訂單仍歸前一個營業日。</p></div>
    <div className="adminBusinessOverride">
      <header><div><span>PRODUCTION TEST OVERRIDE</span><h3>正式環境營業日測試覆寫</h3><p>啟用後會暫時覆寫全站營業日判定，包含顧客點餐、後台與使用營業日的訂單流程；不會修改原本的 BUSINESS_PERIODS 快照。</p></div><strong className={override?.enabled ? 'adminOverrideStatus isActive' : 'adminOverrideStatus'}>{override?.enabled ? '覆寫中' : '未啟用'}</strong></header>
      {override?.enabled ? <div className="adminOverrideWarning">目前所有顧客都會使用測試營業日。請完成測試後立即恢復，或等待自動失效。</div> : null}
      <div className="adminBusinessOverrideGrid"><label>測試營業日<input type="date" value={overrideDate} onChange={(event) => setOverrideDate(event.target.value)} /></label><label>測試開始<input type="time" value={overrideStart} onChange={(event) => setOverrideStart(event.target.value)} /></label><label>測試結束<input type="time" value={overrideEnd} onChange={(event) => setOverrideEnd(event.target.value)} /><small>結束早於開始時視為隔日</small></label><label>自動失效（分鐘）<input type="number" min="1" max="1440" value={overrideDuration} onChange={(event) => setOverrideDuration(Number(event.target.value))} /></label><label className="adminBusinessOverrideReason">測試原因<input value={overrideReason} maxLength="500" onChange={(event) => setOverrideReason(event.target.value)} placeholder="例如：測試跨日營業日與點餐碼有效性" /></label></div>
      <div className="adminBusinessOverrideActions"><AdminButton disabled={overrideBusy || !overrideDate || !overrideReason.trim()} onClick={saveOverride}>{overrideBusy ? '處理中…' : '啟用／更新測試覆寫'}</AdminButton>{override?.enabled ? <AdminButton variant="danger" disabled={overrideBusy} onClick={disableOverride}>立即恢復正常快照</AdminButton> : null}</div>
      {overrideMessage ? <p className="adminOverrideMessage" role="status">{overrideMessage}</p> : null}{overrideError ? <p className="adminOverrideError" role="alert">{overrideError}</p> : null}
    </div>
    <div className="adminOrderingSettingsGrid"><label>低消／信物可折抵金額<input type="number" min="0" value={form.minimumMealCredit} onChange={(event) => setForm({ ...form, minimumMealCredit: Number(event.target.value) })} /></label><label>每節基礎指名費<input type="number" min="0" value={form.baseNominationFee} onChange={(event) => setForm({ ...form, baseNominationFee: Number(event.target.value) })} /></label>{tipPresetAmounts.map((value, index) => <label key={`tip-preset-${index}`}>小費按鈕 {index + 1}（Gil）<input type="number" min="1" max="1000000" value={value} onChange={(event) => setForm({ ...form, tipPresetAmounts: tipPresetAmounts.map((current, currentIndex) => currentIndex === index ? Number(event.target.value) : current) })} /></label>)}<label>每節分鐘<input type="number" min="1" value={form.segmentMinutes} onChange={(event) => setForm({ ...form, segmentMinutes: Number(event.target.value) })} /></label><label>提醒（分鐘）<input type="number" min="1" value={form.reminderAfterMinutes} onChange={(event) => setForm({ ...form, reminderAfterMinutes: Number(event.target.value) })} /></label><label>升級（分鐘）<input type="number" min="1" value={form.escalateAfterMinutes} onChange={(event) => setForm({ ...form, escalateAfterMinutes: Number(event.target.value) })} /></label><label>失效（分鐘）<input type="number" min="1" value={form.expireAfterMinutes} onChange={(event) => setForm({ ...form, expireAfterMinutes: Number(event.target.value) })} /></label></div>
    <div className="adminNominationPause"><label>暫停指名分鐘<input type="number" min="0" max="1440" value={pause} onChange={(event) => setPause(Number(event.target.value))} /></label><AdminButton variant="secondary" onClick={pauseNow}>{pause === 0 ? '立即解除暫停' : `暫停 ${pause} 分鐘`}</AdminButton><span>{settings.nominationPaused ? `目前暫停至 ${new Date(settings.nominationPausedUntil).toLocaleString('zh-TW')}` : '目前開放指名'}</span></div>
  </div>;
}
