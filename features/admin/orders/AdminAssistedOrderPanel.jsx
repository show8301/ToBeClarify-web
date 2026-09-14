import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/features/admin/api/client.js';

const money = (value) => `${Number(value || 0).toLocaleString('zh-TW')} G`;
const nextStart = () => {
  const value = new Date(Date.now() + 20 * 60_000);
  value.setMinutes(Math.ceil(value.getMinutes() / 10) * 10, 0, 0);
  const pad = (part) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};
const iso = (value) => value ? new Date(value).toISOString() : null;

export function AdminAssistedOrderPanel({ sessionId, businessDate, onSaved, onClose }) {
  const [catalog, setCatalog] = useState(null);
  const [cart, setCart] = useState({ meals: [], nominations: [], rooms: [], tips: [], customerNote: '', customerLocation: '' });
  const [meal, setMeal] = useState({ referenceId: '', kind: 'item', quantity: 1 });
  const [nomination, setNomination] = useState({ staffId: '', mode: 'companionship', serviceId: '', segments: 1, participants: 1, startsAt: nextStart() });
  const [room, setRoom] = useState({ roomId: '', segments: 1, startsAt: nextStart() });
  const [tip, setTip] = useState({ staffId: '', amount: 100, staffPercentage: 0 });
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    adminApi.getOrderingCatalog(businessDate, controller.signal).then(setCatalog).catch((reason) => {
      if (!controller.signal.aborted) setError(reason.message);
    });
    return () => controller.abort();
  }, [businessDate]);
  useEffect(() => { setQuote(null); }, [cart.meals, cart.nominations, cart.rooms, cart.tips, cart.customerLocation, cart.customerNote]);

  const products = useMemo(() => {
    if (!catalog) return [];
    const items = (catalog.menu.categories || []).flatMap((category) => (category.items || []).filter((item) => item.policy?.canOrderAlone !== false && item.isAvailable !== false).map((item) => ({ referenceId: item.id, kind: 'item', name: item.itemName, price: item.price })));
    const sets = (catalog.menu.sets || []).filter((item) => item.isOrderable !== false).map((item) => ({ referenceId: item.id, kind: 'set', name: item.setName, price: item.setPrice }));
    return [...items, ...sets];
  }, [catalog]);
  const selectedStaff = catalog?.staff?.find((item) => item.id === nomination.staffId);
  const services = [...(selectedStaff?.commonServices || []), ...(selectedStaff?.specialServices || [])].filter((item) => item.isNominatable && item.price != null);
  const body = {
    meals: cart.meals.map(({ referenceId, kind, quantity }) => ({ referenceId, kind, quantity })),
    nominations: cart.nominations.map(({ staffId, mode, serviceId, segments, participants, startsAt }) => ({ staffId, mode, serviceId: serviceId || null, segmentCount: segments, participantCount: participants, requestedStartsAt: iso(startsAt) })),
    rooms: cart.rooms.map(({ roomId, segments, startsAt }) => ({ roomId, segmentCount: segments, requestedStartsAt: iso(startsAt) })),
    tips: cart.tips.map(({ staffId, amount, staffPercentage }) => ({ staffId: staffId || null, amount, staffPercentage })),
    customerLocation: cart.customerLocation.trim() || null,
    customerNote: cart.customerNote.trim() || null,
  };
  const addMeal = () => {
    const product = products.find((item) => item.referenceId === meal.referenceId && item.kind === meal.kind);
    if (!product) return;
    setCart((current) => ({ ...current, meals: [...current.meals, { ...meal, name: product.name, price: product.price, quantity: Math.max(1, Number(meal.quantity) || 1) }] }));
    setQuote(null);
  };
  const addNomination = () => {
    if (!nomination.staffId) return setError('請先選擇指名店員。');
    if (nomination.mode === 'service' && !nomination.serviceId) return setError('請選擇服務，或改選純陪伴。');
    const staff = catalog.staff.find((item) => item.id === nomination.staffId);
    const service = services.find((item) => item.id === nomination.serviceId);
    setCart((current) => ({ ...current, nominations: [...current.nominations, { ...nomination, staffName: staff?.displayName, serviceName: service?.serviceName || '純陪伴', segments: Math.max(1, Number(nomination.segments) || 1), participants: Math.max(1, Number(nomination.participants) || 1) }] }));
    setQuote(null); setError('');
  };
  const addRoom = () => {
    if (!room.roomId) return setError('請先選擇包廂。');
    const selected = catalog.rooms.find((item) => item.id === room.roomId);
    setCart((current) => ({ ...current, rooms: [...current.rooms, { ...room, roomName: selected?.roomName, segments: Math.max(1, Number(room.segments) || 1) }] }));
    setQuote(null); setError('');
  };
  const addTip = () => {
    if (Number(tip.amount) < 1) return setError('小費金額需大於 0。');
    setCart((current) => ({ ...current, tips: [...current.tips, { ...tip, amount: Math.max(1, Number(tip.amount) || 1), staffPercentage: tip.staffId ? Math.max(0, Math.min(100, Number(tip.staffPercentage) || 0)) : 0 }] }));
    setQuote(null); setError('');
  };
  const requestQuote = async () => {
    if (!body.meals.length && !body.nominations.length && !body.rooms.length && !body.tips.length) return setError('請先加入至少一個品項。');
    setBusy(true); setError('');
    try { setQuote(await adminApi.quoteAssistedOrder(sessionId, body)); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!quote) return requestQuote();
    setBusy(true); setError('');
    try { await adminApi.submitAssistedOrder(sessionId, { ...body, quoteToken: quote.quoteToken }); await onSaved(); onClose(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  if (!catalog) return <section className="adminOrderInlinePanel"><header><h2>代客點餐</h2><button type="button" onClick={onClose}>×</button></header><p>載入菜單與可用時段中…</p>{error ? <p className="adminFormError">{error}</p> : null}</section>;
  return <section className="adminOrderInlinePanel adminAssistedOrderPanel"><header><div><span>STAFF ASSIST</span><h2>代客點餐</h2><p>沿用顧客相同的菜單、時段、折抵與衝突檢查；指名只會送出等待確認的需求。</p></div><button type="button" onClick={onClose}>×</button></header>
    <div className="adminAssistedOrderGrid">
      <div><h3>餐點</h3><div className="adminInlineFields"><select value={`${meal.kind}:${meal.referenceId}`} onChange={(event) => { const [kind, referenceId] = event.target.value.split(':'); setMeal({ ...meal, kind, referenceId }); setQuote(null); }}><option value=":">選擇餐點／套餐</option>{products.map((item) => <option key={`${item.kind}:${item.referenceId}`} value={`${item.kind}:${item.referenceId}`}>{item.name} · {money(item.price)}</option>)}</select><input type="number" min="1" max="99" value={meal.quantity} onChange={(event) => setMeal({ ...meal, quantity: event.target.value })} /><button type="button" onClick={addMeal}>加入</button></div>{cart.meals.map((item, index) => <p key={`${item.referenceId}-${index}`}>{item.name} × {item.quantity} <button type="button" onClick={() => setCart((current) => ({ ...current, meals: current.meals.filter((_, i) => i !== index) }))}>移除</button></p>)}</div>
      <div><h3>指名服務</h3><div className="adminAssistedFields"><select value={nomination.staffId} onChange={(event) => setNomination({ ...nomination, staffId: event.target.value, serviceId: '' })}><option value="">選擇店員</option>{catalog.staff.filter((item) => item.isNominatable).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><select value={nomination.mode === 'companionship' ? 'companionship' : nomination.serviceId} onChange={(event) => setNomination({ ...nomination, mode: event.target.value === 'companionship' ? 'companionship' : 'service', serviceId: event.target.value === 'companionship' ? '' : event.target.value })}><option value="companionship">純陪伴</option>{services.map((item) => <option key={item.id} value={item.id}>{item.serviceName} · {money(item.price)}</option>)}</select><input type="datetime-local" value={nomination.startsAt} onChange={(event) => setNomination({ ...nomination, startsAt: event.target.value })} /><span><label>節數 <input type="number" min="1" max="72" value={nomination.segments} onChange={(event) => setNomination({ ...nomination, segments: event.target.value })} /></label><label>人數 <input type="number" min="1" max="20" value={nomination.participants} onChange={(event) => setNomination({ ...nomination, participants: event.target.value })} /></label></span><button type="button" onClick={addNomination}>加入</button></div>{cart.nominations.map((item, index) => <p key={`${item.staffId}-${index}`}>{item.staffName}｜{item.serviceName} × {item.segments} 節 <button type="button" onClick={() => setCart((current) => ({ ...current, nominations: current.nominations.filter((_, i) => i !== index) }))}>移除</button></p>)}</div>
      <div><h3>包廂</h3><div className="adminAssistedFields"><select value={room.roomId} onChange={(event) => setRoom({ ...room, roomId: event.target.value })}><option value="">選擇包廂</option>{catalog.rooms.filter((item) => item.segmentPrice > 0).map((item) => <option key={item.id} value={item.id}>{item.roomName} · {money(item.segmentPrice)}／節</option>)}</select><input type="datetime-local" value={room.startsAt} onChange={(event) => setRoom({ ...room, startsAt: event.target.value })} /><input type="number" min="1" max="72" value={room.segments} onChange={(event) => setRoom({ ...room, segments: event.target.value })} /><button type="button" onClick={addRoom}>加入</button></div>{cart.rooms.map((item, index) => <p key={`${item.roomId}-${index}`}>{item.roomName} × {item.segments} 節 <button type="button" onClick={() => setCart((current) => ({ ...current, rooms: current.rooms.filter((_, i) => i !== index) }))}>移除</button></p>)}</div>
      <div><h3>小費</h3><div className="adminInlineFields"><input type="number" min="1" value={tip.amount} onChange={(event) => setTip({ ...tip, amount: event.target.value })} /><select value={tip.staffId} onChange={(event) => setTip({ ...tip, staffId: event.target.value })}><option value="">店家 100%</option>{catalog.staff.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><input type="number" min="0" max="100" value={tip.staffPercentage} disabled={!tip.staffId} onChange={(event) => setTip({ ...tip, staffPercentage: event.target.value })} /><button type="button" onClick={addTip}>加入</button></div>{cart.tips.map((item, index) => <p key={`tip-${index}`}>小費 {money(item.amount)}{item.staffId ? ` · 店員 ${item.staffPercentage}%` : ''} <button type="button" onClick={() => setCart((current) => ({ ...current, tips: current.tips.filter((_, i) => i !== index) }))}>移除</button></p>)}</div>
    </div>
    <div className="adminAssistedNotes"><label>顧客位置（選填）<input maxLength={200} value={cart.customerLocation} onChange={(event) => { setCart({ ...cart, customerLocation: event.target.value }); setQuote(null); }} placeholder="例：A 區 3 號桌" /></label><label>顧客備註（選填）<textarea maxLength={500} rows={2} value={cart.customerNote} onChange={(event) => { setCart({ ...cart, customerNote: event.target.value }); setQuote(null); }} /></label></div>
    {error ? <p className="adminFormError" role="alert">{error}</p> : null}{quote ? <div className="adminAssistedQuote"><strong>正式報價：{money(quote.totalAmount)}</strong><span>餐點折抵 {money(quote.mealCreditApplied)} · 剩餘信物 {money(quote.remainingMealCredit)}</span><button type="button" disabled={busy} onClick={submit}>{busy ? '送出中…' : '確認報價並送出'}</button></div> : <button className="adminPrimaryButton" type="button" disabled={busy} onClick={requestQuote}>{busy ? '計算中…' : '預覽價格與折抵'}</button>}
  </section>;
}
