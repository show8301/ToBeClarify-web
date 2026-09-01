"use client";

import { useEffect, useMemo, useState } from 'react';
import { orderingApi } from './ordering-api.js';

const TOKEN_KEY = 'lucid-dream-order-token';
const money = (value) => `${Number(value || 0).toLocaleString('zh-TW')} G`;
const tipMoney = (value) => `${Number(value || 0).toLocaleString('zh-TW')} Gil`;
const defaultTipPresetAmounts = [50, 100, 200, 500];
const normalizeTipPresetAmounts = (values) => {
  const next = Array.isArray(values) ? values.map(Number) : [];
  return next.length === 4 && next.every((value) => Number.isFinite(value) && value > 0) ? next : defaultTipPresetAmounts;
};
const statusLabels = { waiting: '等待確認', submitted: '等待確認', partially_confirmed: '部分確認', needs_reschedule: '需重新排程', confirmed: '已成立', in_service: '服務中', completed: '已完成', cancelled: '已取消', expired: '已失效', rejected: '已退回' };

function defaultStart() {
  const date = new Date(Date.now() + 20 * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 10) * 10, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function OrderClient() {
  const [token, setToken] = useState('');
  const [session, setSession] = useState(null);
  const [businessContext, setBusinessContext] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('meal');
  const [cart, setCart] = useState({ meals: [], nominations: [], tips: [] });
  const [notice, setNotice] = useState({ message: '', error: false });
  const [loading, setLoading] = useState(true);

  const load = async (nextToken, signal) => {
    setLoading(true);
    setNotice({ message: '', error: false });
    try {
      const [access, nextCatalog, nextOrders] = await Promise.all([
        orderingApi.access(nextToken, signal), orderingApi.catalog(nextToken, signal), orderingApi.orders(nextToken, signal),
      ]);
      setToken(nextToken);
      setSession(access.session);
      setBusinessContext(access.businessContext);
      setCatalog(nextCatalog);
      setOrders(nextOrders || []);
      localStorage.setItem(TOKEN_KEY, nextToken);
      if (nextCatalog.settings.nominationPaused && tab === 'nomination') setTab('meal');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setSession(null);
      setBusinessContext(null);
      setCatalog(null);
      setNotice({ message: error.message, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('code') || localStorage.getItem(TOKEN_KEY) || '';
    if (initial) load(initial, controller.signal);
    else setLoading(false);
    return () => controller.abort();
  }, []);

  const cartCount = cart.meals.reduce((sum, line) => sum + line.quantity, 0)
    + cart.nominations.filter((line) => !line.baseRemoved).length + cart.tips.length;
  const cartSubtotal = cart.meals.reduce((sum, line) => sum + line.price * line.quantity, 0)
    + cart.nominations.reduce((sum, line) => sum + (line.baseRemoved ? 0 : line.baseTotal) + (line.serviceRemoved ? 0 : line.serviceTotal), 0)
    + cart.tips.reduce((sum, line) => sum + line.amount, 0);

  const submit = async () => {
    const incomplete = cart.nominations.some((line) => line.mode === 'service' && line.serviceRemoved && !line.baseRemoved);
    if (incomplete) {
      setNotice({ message: '已刪除服務項目，請再刪除對應的基礎指名費，或重新加入服務。', error: true });
      setTab('cart');
      return;
    }
    setLoading(true);
    try {
      const submitted = await orderingApi.submit(token, {
        meals: cart.meals.map(({ referenceId, kind, quantity }) => ({ referenceId, kind, quantity })),
        nominations: cart.nominations.filter((line) => !line.baseRemoved && (line.mode === 'companionship' || !line.serviceRemoved)).map((line) => ({
          staffId: line.staffId, mode: line.mode, serviceId: line.serviceId || null, segmentCount: line.segments,
          participantCount: line.participants, requestedStartsAt: new Date(line.startsAt).toISOString(),
        })),
        tips: cart.tips.map(({ staffId, amount, staffPercentage }) => ({ staffId: staffId || null, amount, staffPercentage })),
      });
      setCart({ meals: [], nominations: [], tips: [] });
      setOrders(await orderingApi.orders(token));
      const access = await orderingApi.access(token);
      setSession(access.session);
      setBusinessContext(access.businessContext);
      setNotice({ message: submitted.storeConfirmationStatus === 'pending' ? '協調單已送出，需店員接受後才會成立。' : '訂單已送出。指名服務將在被指名店員確認後成立。', error: false });
      setTab('orders');
    } catch (error) {
      setNotice({ message: error.message, error: true });
    } finally { setLoading(false); }
  };

  const recover = async (gameId, recoveryCode) => {
    setLoading(true);
    try {
      const issued = await orderingApi.recover({ gameId, recoveryCode });
      window.history.replaceState(null, '', `/order?code=${encodeURIComponent(issued.orderToken)}`);
      await load(issued.orderToken);
      setNotice({ message: '已找回今天的點餐資料。', error: false });
      setTab('meal');
    } catch (error) { setNotice({ message: error.message, error: true }); setLoading(false); }
  };

  if (loading && !session) return <OrderLoading />;
  if (!session || !catalog) return <OrderAccess notice={notice} onAccess={(value) => load(value)} onRecover={recover} loading={loading} />;

  const tabs = [
    ['meal', '一般點餐'],
    ...(!catalog.settings.nominationPaused ? [['nomination', '指名服務']] : []),
    ['tip', '小費'], ['cart', `本次點餐 ${cartCount || ''}`], ['orders', '我的訂單'], ['help', '請洽店員'],
  ];

  return (
    <main className="orderShell">
      <header className="orderTopbar">
        <a href="/" className="orderBrand"><img src="/favicon.ico" alt="" /><span><strong>清醒夢</strong><small>LUCID DREAM / ORDER</small></span></a>
        <div className="orderSessionChip"><span>今日點餐</span><strong>{session.customerName}</strong><small>ID {session.gameId}</small></div>
        <div className="orderCredit"><span>信物餐點餘額</span><strong>{money(session.remainingMealCredit)}</strong></div>
      </header>
      <CustomerOrderingStatus context={businessContext} session={session} />
      {catalog.settings.nominationPaused ? <div className="orderPauseBanner">目前暫停受理指名服務；一般餐點與小費仍可正常加點。</div> : null}
      {notice.message ? <div className={`orderNotice ${notice.error ? 'isError' : ''}`} role="status">{notice.message}<button type="button" onClick={() => setNotice({ message: '', error: false })}>×</button></div> : null}
      <nav className="orderTabs" aria-label="點餐功能">
        {tabs.map(([key, label], index) => <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'isActive' : ''} onClick={() => setTab(key)}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>)}
      </nav>
      <section className="orderWorkspace">
        <div className="orderMain">
          {tab === 'meal' ? <MealPage menu={catalog.menu} cart={cart} setCart={setCart} /> : null}
          {tab === 'nomination' ? <NominationPage session={session} settings={catalog.settings} businessContext={businessContext} staff={catalog.staff} cart={cart} setCart={setCart} onNotice={setNotice} /> : null}
          {tab === 'tip' ? <TipPage staff={catalog.staff} settings={catalog.settings} setCart={setCart} onAdded={() => setNotice({ message: '小費分配已加入本次點餐。', error: false })} /> : null}
          {tab === 'cart' ? <CartPage cart={cart} setCart={setCart} session={session} businessContext={businessContext} subtotal={cartSubtotal} onSubmit={submit} loading={loading} /> : null}
          {tab === 'orders' ? <MyOrders orders={orders} catalog={catalog} loading={loading} onAddon={async (body) => { setLoading(true); try { await orderingApi.submitAddon(token, body); setOrders(await orderingApi.orders(token)); setNotice({ message: '加購服務已送出，等待被指名店員確認。', error: false }); } catch (error) { setNotice({ message: error.message, error: true }); } finally { setLoading(false); } }} /> : null}
          {tab === 'help' ? <HelpPage currentGameId={session.gameId} onRecover={recover} loading={loading} /> : null}
        </div>
        <aside className="orderAside">
          <div><span>本次點餐</span><strong>{cartCount} 項</strong></div>
          <p>餐點、指名服務與小費會在送出前集中顯示；指名費與服務費分列。</p>
          <dl><div><dt>小計</dt><dd>{money(cartSubtotal)}</dd></div><div><dt>可折抵餐點</dt><dd>{money(Math.min(session.remainingMealCredit, cart.meals.reduce((sum, line) => sum + line.price * line.quantity, 0)))}</dd></div></dl>
          <button type="button" onClick={() => setTab('cart')}>查看明細與送出</button>
          <button className="isSecondary" type="button" onClick={() => setTab('orders')}>查看我的訂單</button>
        </aside>
      </section>
    </main>
  );
}

function OrderLoading() {
  return <main className="orderGate"><div className="orderGateCard"><span className="orderGateMark">LD</span><p>正在確認今日點餐資格…</p></div></main>;
}

function CustomerOrderingStatus({ context, session }) {
  if (!context) return null;
  const readOnly = session.status !== 'active' || context.periodStatus !== 'open';
  if (readOnly) return <div className="orderBusinessBanner isClosed"><strong>目前停止新增訂單</strong><span>點餐碼仍可查看既有訂單；如需加點請洽店員協助。</span></div>;
  if (context.intakeMode === 'staff_only') return <div className="orderBusinessBanner isStaffOnly"><strong>目前改由店員協助送單</strong><span>您仍可選擇餐點並保留本次內容，完成後請洽店員。</span></div>;
  if (context.requiresStoreConfirmation || context.intakeMode === 'coordination') return <div className="orderBusinessBanner isCoordination"><strong>目前為協調接單</strong><span>仍可送出點餐內容；需店員確認能否承接後才成立。</span></div>;
  return <div className="orderBusinessBanner isOpen"><strong>目前可正常點餐</strong><span>預計接單至 {new Date(context.projectedCloseAt || context.referenceEndsAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span></div>;
}

function OrderAccess({ notice, onAccess, onRecover, loading }) {
  const [code, setCode] = useState('');
  const [showRecover, setShowRecover] = useState(false);
  const [form, setForm] = useState({ gameId: '', recoveryCode: '' });
  return (
    <main className="orderGate"><section className="orderGateCard">
      <a href="/" className="orderBrand"><img src="/favicon.ico" alt="" /><span><strong>清醒夢</strong><small>LUCID DREAM / ORDER</small></span></a>
      <p className="orderEyebrow">TODAY&apos;S ORDER PASS</p><h1>{showRecover ? '請洽店員' : '輸入今日點餐碼'}</h1>
      <p>{showRecover ? '向店員取得六位數協助碼，與遊戲 ID 一起輸入即可找回今天的點餐網址。' : '若由店員提供專屬網址，頁面會自動帶入；也可手動貼上點餐碼。'}</p>
      {notice.message ? <div className={`orderNotice ${notice.error ? 'isError' : ''}`}>{notice.message}</div> : null}
      {showRecover ? <form onSubmit={(event) => { event.preventDefault(); onRecover(form.gameId.trim(), form.recoveryCode.trim()); }}>
        <label>顧客遊戲 ID<input value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value })} required /></label>
        <label>店員協助碼<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.recoveryCode} onChange={(event) => setForm({ ...form, recoveryCode: event.target.value.replace(/\D/g, '') })} required /></label>
        <button disabled={loading} type="submit">找回並刷新點餐頁</button>
      </form> : <form onSubmit={(event) => { event.preventDefault(); onAccess(code.trim()); }}>
        <label>點餐碼<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" required /></label>
        <button disabled={loading} type="submit">開始點餐</button>
      </form>}
      <button className="orderTextButton" type="button" onClick={() => setShowRecover(!showRecover)}>{showRecover ? '返回輸入點餐碼' : '找不到點餐碼？請洽店員'}</button>
    </section></main>
  );
}

function MealPage({ menu, cart, setCart }) {
  const [category, setCategory] = useState(menu.categories?.[0]?.id || 'sets');
  const products = category === 'sets' ? (menu.sets || []).map((item) => ({ ...item, id: item.id, name: item.setName, description: item.setDescription, price: item.setPrice, kind: 'set' }))
    : (menu.categories?.find((item) => item.id === category)?.items || []).map((item) => ({ ...item, name: item.itemName, description: item.itemDescription, kind: 'item' }));
  const add = (product) => setCart((current) => {
    const found = current.meals.find((line) => line.referenceId === product.id && line.kind === product.kind);
    const meals = found ? current.meals.map((line) => line === found ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current.meals, { referenceId: product.id, kind: product.kind, name: product.name, price: product.price, quantity: 1 }];
    return { ...current, meals };
  });
  return <div className="orderPage"><PageHeading kicker="FOOD & DRINK" title="一般點餐" text="信物餘額只會折抵餐點；未使用完的餘額保留到今天後續加點。" />
    <div className="orderCategoryRail"><button className={category === 'sets' ? 'isActive' : ''} onClick={() => setCategory('sets')}>套餐</button>{(menu.categories || []).map((item) => <button className={category === item.id ? 'isActive' : ''} key={item.id} onClick={() => setCategory(item.id)}>{item.categoryName}</button>)}</div>
    <div className="orderProductGrid">{products.map((item) => <article key={item.id} className="orderProductCard"><div className="orderProductImage">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>LD</span>}</div><div><small>{item.kind === 'set' ? 'SET' : 'MENU'}</small><h2>{item.name}</h2><p>{item.description || '現場供應品項'}</p></div><footer><strong>{money(item.price)}</strong><button type="button" aria-label={`加入 ${item.name}`} onClick={() => add(item)}><span aria-hidden="true">＋</span> 加入</button></footer></article>)}</div>
  </div>;
}

function NominationPage({ session, settings, businessContext, staff, cart, setCart, onNotice }) {
  const available = staff.filter((person) => person.isWorkingToday && person.isNominatable && person.currentStatus !== 'busy');
  const [staffId, setStaffId] = useState(available[0]?.id || '');
  const selectedStaff = staff.find((person) => person.id === staffId);
  const services = [...(selectedStaff?.commonServices || []), ...(selectedStaff?.specialServices || [])].filter((item) => item.isNominatable && item.price != null);
  const [mode, setMode] = useState('companionship');
  const [serviceId, setServiceId] = useState('');
  const [segments, setSegments] = useState(1);
  const [participants, setParticipants] = useState(1);
  const [startsAt, setStartsAt] = useState(defaultStart);
  useEffect(() => { setServiceId(''); setSegments(1); setMode('companionship'); }, [staffId]);
  const service = services.find((item) => item.id === serviceId);
  const minimumSegments = service?.durationMinutes ? Math.ceil(service.durationMinutes / settings.segmentMinutes) : 1;
  const safeSegments = Math.max(segments, minimumSegments);
  const serviceUnit = service ? Number(service.price) + Math.max(0, participants - 1) * Number(service.additionalPersonPrice || 0) : 0;
  const baseTotal = settings.baseNominationFee * safeSegments;
  const serviceTotal = service ? serviceUnit * (service.durationMinutes ? 1 : safeSegments) : 0;
  const requestedBusyUntil = new Date(startsAt).getTime() + (safeSegments * settings.segmentMinutes + Number(selectedStaff?.bufferMinutes || 0)) * 60_000;
  const needsCloseCoordination = businessContext?.projectedCloseAt && requestedBusyUntil > new Date(businessContext.projectedCloseAt).getTime();
  const already = cart.nominations.filter((line) => !line.baseRemoved).length;
  const add = () => {
    if (!selectedStaff || (mode === 'service' && !service)) return onNotice({ message: '請先選擇店員與指名方式。', error: true });
    if (already >= session.maxNominatedStaff) return onNotice({ message: `本次最多可同時指名 ${session.maxNominatedStaff} 位店員。`, error: true });
    if (cart.nominations.some((line) => line.staffId === selectedStaff.id && !line.baseRemoved)) return onNotice({ message: '同一張訂單每位店員只能加入一次；追加時數請另開新訂單。', error: true });
    setCart((current) => ({ ...current, nominations: [...current.nominations, { id: crypto.randomUUID(), mode, staffId: selectedStaff.id, staffName: selectedStaff.displayName, serviceId: service?.id || null, serviceName: service?.serviceName || '純陪伴', segments: safeSegments, participants, startsAt, duration: service?.durationMinutes || safeSegments * settings.segmentMinutes, baseFee: settings.baseNominationFee, baseTotal, serviceUnit, serviceTotal, serviceRemoved: false, baseRemoved: false }] }));
    onNotice({ message: mode === 'companionship' ? '純陪伴與基礎指名費已加入本次點餐；成立後仍可在原時段內追加服務。' : '指名服務與基礎指名費已分列加入本次點餐。', error: false });
  };
  return <div className="orderPage"><PageHeading kicker="STAFF FIRST" title="指名服務" text={`先選店員，再查看該店員提供的服務。每節 ${settings.segmentMinutes} 分鐘，最多同時指名 ${session.maxNominatedStaff} 人。`} />
    <section className="nominationSection"><header><span>01</span><div><h2>選擇店員</h2><p>忙碌中的店員不可選擇；電腦版以緊密卡片顯示今日上班人員。</p></div></header>
      <div className="nominationStaffGrid">{staff.map((person) => { const disabled = !available.some((item) => item.id === person.id); return <button key={person.id} disabled={disabled} className={staffId === person.id ? 'isActive' : ''} onClick={() => setStaffId(person.id)}><span>{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : person.displayName.slice(0, 1)}</span><strong>{person.displayName}</strong><small>{disabled ? (person.currentStatus === 'busy' ? '忙碌中' : '未開放') : '可指名'}</small></button>; })}</div>
    </section>
    {selectedStaff ? <section className="nominationSection"><header><span>02</span><div><h2>選擇指名方式</h2><p>純陪伴只收基礎指名費；服務成立後仍可在原本時段內追加服務，不會再收一次基礎費。</p></div></header>
      <div className="nominationModeGrid"><button type="button" className={mode === 'companionship' ? 'isActive' : ''} onClick={() => { setMode('companionship'); setServiceId(''); setSegments(1); }}><span>COMPANIONSHIP</span><strong>純陪伴</strong><p>先保留陪伴時段，稍後再視現場需求追加服務。</p></button><button type="button" className={mode === 'service' ? 'isActive' : ''} onClick={() => setMode('service')}><span>SERVICE</span><strong>加購服務</strong><p>現在就選擇服務；基礎指名費與服務費分列。</p></button></div>
      {mode === 'service' ? <div className="nominationServiceGrid">{services.map((item) => <button key={item.id} className={serviceId === item.id ? 'isActive' : ''} onClick={() => { setServiceId(item.id); setSegments(item.durationMinutes ? Math.ceil(item.durationMinutes / settings.segmentMinutes) : 1); }}><span>{item.serviceType === 'special' ? 'SPECIAL' : 'SERVICE'}</span><strong>{item.serviceName}</strong><p>{item.serviceDescription}</p><footer><b>{money(item.price)}</b><small>{item.durationMinutes ? `${item.durationMinutes} 分鐘／單次` : '每節計費'}</small></footer></button>)}</div> : null}
    </section> : null}
    {selectedStaff && (mode === 'companionship' || service) ? <section className="nominationComposer"><div><span>03 / 排程與節數</span><h2>{selectedStaff.displayName}｜{mode === 'companionship' ? '純陪伴' : service.serviceName}</h2>{needsCloseCoordination ? <p className="nominationCoordinationHint">此時段會超過目前預計關店時間；可以送出，但需現場協調並由店員接受後才成立。</p> : null}</div><div className="nominationControls">
      <label>開始時間<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
      <label>節數<div className="stepper"><button type="button" onClick={() => setSegments(Math.max(minimumSegments, segments - 1))}>−</button><strong>{safeSegments}</strong><button type="button" onClick={() => setSegments(Math.min(72, segments + 1))}>＋</button></div><small>涵蓋 {safeSegments * settings.segmentMinutes} 分鐘{service?.durationMinutes ? `；服務需 ${service.durationMinutes} 分鐘` : ''}</small></label>
      {mode === 'service' ? <label>參與人數<div className="stepper"><button type="button" onClick={() => setParticipants(Math.max(1, participants - 1))}>−</button><strong>{participants}</strong><button type="button" onClick={() => setParticipants(Math.min(20, participants + 1))}>＋</button></div></label> : null}
    </div><div className="nominationPrice"><div><span>基礎指名費</span><b>{money(settings.baseNominationFee)} × {safeSegments} 節</b><strong>{money(baseTotal)}</strong></div>{mode === 'service' ? <div><span>服務費</span><b>{money(serviceUnit)} {service.durationMinutes ? '× 1 次' : `× ${safeSegments} 節`}</b><strong>{money(serviceTotal)}</strong></div> : <div><span>服務費</span><b>稍後可在我的訂單追加</b><strong>{money(0)}</strong></div>}<footer><span>本項合計</span><strong>{money(baseTotal + serviceTotal)}</strong></footer></div><button className="orderPrimaryAction" type="button" onClick={add}>加入本次點餐</button></section> : null}
  </div>;
}

function TipPage({ staff, settings, setCart, onAdded }) {
  const presetAmounts = normalizeTipPresetAmounts(settings?.tipPresetAmounts);
  const [amount, setAmount] = useState(() => presetAmounts[1] || presetAmounts[0]);
  const [staffId, setStaffId] = useState('');
  const [staffPercentage, setStaffPercentage] = useState(50);
  const selected = staff.find((person) => person.id === staffId);
  const effectiveStaff = selected ? staffPercentage : 0;
  const staffAmount = Math.floor(amount * effectiveStaff / 100);
  const storeAmount = amount - staffAmount;
  const add = () => { setCart((current) => ({ ...current, tips: [...current.tips, { id: crypto.randomUUID(), staffId, staffName: selected?.displayName || '', amount, staffPercentage: effectiveStaff }] })); onAdded(); };
  return <div className="orderPage"><PageHeading kicker="TIP ALLOCATION" title="小費" text="先選金額，再選店員與比例；未指定店員時，小費 100% 歸店家。" />
    <section className="tipComposer"><div className="tipAmountButtons">{presetAmounts.map((value) => <button type="button" className={amount === value ? 'isActive' : ''} key={value} onClick={() => setAmount(value)}>{tipMoney(value)}</button>)}<label>自訂<input type="number" min="1" value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value)))} /></label></div>
      <label className="tipStaffSelect">指定店員（選填）<select value={staffId} onChange={(event) => setStaffId(event.target.value)}><option value="">不指定，店家 100%</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
      <div className="tipSplit"><div><strong>{selected?.displayName || '店員'}</strong><span>{effectiveStaff}% · {money(staffAmount)}</span></div><div className="tipRange"><input aria-label="店員小費比例" type="range" min="0" max="100" value={effectiveStaff} disabled={!selected} onChange={(event) => setStaffPercentage(Number(event.target.value))} /><small><span>店員比例增加</span><span>店家比例增加</span></small></div><div><strong>店家</strong><span>{100 - effectiveStaff}% · {money(storeAmount)}</span></div></div>
      <div className="tipResult"><span>分配後實際金額</span><strong>{selected ? `${selected.displayName} ${money(staffAmount)} ／ ` : ''}店家 {money(storeAmount)}</strong></div>
      <button className="orderPrimaryAction" type="button" onClick={add}>將此分配結果加入本次點餐</button>
    </section>
  </div>;
}

function CartPage({ cart, setCart, session, businessContext, subtotal, onSubmit, loading }) {
  const mealSubtotal = cart.meals.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const credit = Math.min(session.remainingMealCredit, mealSubtotal);
  const removeMeal = (index) => setCart((current) => ({ ...current, meals: current.meals.filter((_, i) => i !== index) }));
  const removeTip = (index) => setCart((current) => ({ ...current, tips: current.tips.filter((_, i) => i !== index) }));
  const removeNominationPart = (id, part) => setCart((current) => ({ ...current, nominations: current.nominations.map((line) => line.id !== id ? line : { ...line, [part === 'service' ? 'serviceRemoved' : 'baseRemoved']: true }).filter((line) => !(line.baseRemoved && (line.mode === 'companionship' || line.serviceRemoved))) }));
  const empty = cart.meals.length + cart.nominations.length + cart.tips.length === 0;
  const customerSubmitBlocked = session.status !== 'active' || businessContext?.periodStatus !== 'open' || businessContext?.intakeMode === 'staff_only';
  const coordination = businessContext?.intakeMode === 'coordination' || businessContext?.requiresStoreConfirmation;
  return <div className="orderPage"><PageHeading kicker="REVIEW" title="查看明細" text="快速刪除每個選項；指名服務必須先刪除服務項目，才能刪除相依的基礎指名費。" />
    {empty ? <EmptyState title="本次點餐還是空的" text="從一般點餐、指名服務或小費頁加入項目。" /> : <div className="cartLayout"><div className="cartLines">
      {cart.meals.map((item, index) => <CartLine key={`${item.referenceId}-${index}`} label="餐點" title={`${item.name} × ${item.quantity}`} price={item.price * item.quantity} onRemove={() => removeMeal(index)} />)}
      {cart.nominations.map((item) => <div className="cartNominationGroup" key={item.id}><header><span>{item.staffName}</span><small>{item.segments} 節 · {item.duration} 分鐘 · {new Date(item.startsAt).toLocaleString('zh-TW')}</small></header>{item.mode === 'service' ? (!item.serviceRemoved ? <CartLine label="服務項目" title={item.serviceName} price={item.serviceTotal} onRemove={() => removeNominationPart(item.id, 'service')} /> : <div className="cartRemoved">服務項目已刪除，現在可刪除基礎指名費。</div>) : <div className="cartCompanionship"><strong>純陪伴</strong><span>成立後可在原指名時段內附掛加購服務。</span></div>}{!item.baseRemoved ? <CartLine label="基礎指名費" title={`${money(item.baseFee)} × ${item.segments} 節`} price={item.baseTotal} disabled={item.mode === 'service' && !item.serviceRemoved} removeHint={item.mode === 'service' && !item.serviceRemoved ? '請先刪除服務項目' : ''} onRemove={() => removeNominationPart(item.id, 'base')} /> : null}</div>)}
      {cart.tips.map((item, index) => <CartLine key={item.id} label="小費" title={item.staffName ? `${item.staffName} ${item.staffPercentage}%／店家 ${100 - item.staffPercentage}%` : '店家 100%'} price={item.amount} onRemove={() => removeTip(index)} />)}
    </div><aside className="cartSummary"><h2>本次結算</h2><dl><div><dt>品項小計</dt><dd>{money(subtotal)}</dd></div><div className="isCredit"><dt>信物折抵（僅餐點）</dt><dd>− {money(credit)}</dd></div><div className="isTotal"><dt>本次應付</dt><dd>{money(subtotal - credit)}</dd></div></dl><p>{customerSubmitBlocked ? '本次內容會保留；請洽店員從後台協助送出。' : coordination ? '目前為協調接單；送出後需店員接受才成立，指名仍需被指名店員確認。' : '指名訂單送出後仍須等待被指名店員確認。追加服務時數請另開新訂單。'}</p><button disabled={loading || customerSubmitBlocked} type="button" onClick={onSubmit}>{customerSubmitBlocked ? '請洽店員協助送出' : coordination ? '送出並等待店員確認' : '確認並送出訂單'}</button></aside></div>}
  </div>;
}

function CartLine({ label, title, price, onRemove, disabled, removeHint }) {
  return <article className="cartLine"><span>{label}</span><div><strong>{title}</strong>{removeHint ? <small>{removeHint}</small> : null}</div><b>{money(price)}</b><button type="button" disabled={disabled} onClick={onRemove} aria-label={`刪除 ${title}`}>×</button></article>;
}

function MyOrders({ orders, catalog, loading, onAddon }) {
  const [open, setOpen] = useState(orders[0]?.id || '');
  return <div className="orderPage"><PageHeading kicker="ORDER HISTORY" title="我的訂單" text="查看今天每次加點的狀態、排程、金額與狀態歷程。" />
    {orders.length === 0 ? <EmptyState title="今天還沒有訂單" text="完成本次點餐後，訂單會出現在這裡。" /> : <div className="myOrderList">{orders.map((order) => <article key={order.id} className={`myOrderCard status-${order.status}`}><button className="myOrderHead" type="button" onClick={() => setOpen(open === order.id ? '' : order.id)}><div><span>{order.orderKind === 'service_addon' ? '附掛加購服務單' : order.orderNumber}</span><strong>{order.storeConfirmationStatus === 'pending' ? '等待店員接受協調單' : statusLabels[order.status] || order.status}</strong></div><div><small>{new Date(order.submittedAt).toLocaleString('zh-TW')}</small><b>{money(order.totalAmount)}</b></div></button>{open === order.id ? <div className="myOrderDetail">{order.storeConfirmationStatus === 'pending' ? <div className="myOrderCoordination"><strong>此單尚未成立</strong><span>店員接受後，才會進入一般成立／指名確認流程。</span></div> : null}<div className="myOrderStage"><span>{order.queueStage}</span>{order.queueMinutes ? <small>已等待 {order.queueMinutes} 分鐘</small> : null}</div><div className="myOrderItems">{order.items.map((item) => <div key={item.id}><span>{item.name}</span><b>{money(item.lineTotal)}</b></div>)}</div>{order.addons?.map((item) => <div className="myOrderAddon" key={item.id}><span>ADD-ON</span><strong>{item.staffName}｜{item.serviceName}</strong><small>{item.serviceDurationMinutes} 分鐘 · {item.participantCount} 人 · {statusLabels[item.status] || item.status}</small></div>)}{order.nominees.map((item) => <div className="myOrderNominee" key={item.id}><strong>{item.staffName}｜{item.serviceName}</strong><span>{item.segmentCount} 節 · {new Date(item.requestedStartsAt).toLocaleString('zh-TW')}</span><small>店員狀態：{item.confirmationStatus}</small>{['confirmed', 'in_service'].includes(order.status) && new Date(item.requestedServiceEndsAt).getTime() > Date.now() ? <CustomerAddonComposer nominee={item} catalog={catalog} loading={loading} onAddon={onAddon} /> : null}</div>)}<dl><div><dt>小計</dt><dd>{money(order.subtotal)}</dd></div><div><dt>信物折抵</dt><dd>− {money(order.mealCreditApplied)}</dd></div><div><dt>應付</dt><dd>{money(order.totalAmount)}</dd></div></dl><ol className="orderTimeline">{order.history.map((item, index) => <li key={`${item.createdAt}-${index}`}><span>{new Date(item.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span><div><strong>{statusLabels[item.toStatus] || item.toStatus}</strong><p>{item.reason}</p></div></li>)}</ol></div> : null}</article>)}</div>}
  </div>;
}

function CustomerAddonComposer({ nominee, catalog, loading, onAddon }) {
  const [open, setOpen] = useState(false);
  const staff = catalog.staff.find((item) => item.id === nominee.staffId);
  const services = [...(staff?.commonServices || []), ...(staff?.specialServices || [])].filter((item) => item.isNominatable && item.price != null);
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [segments, setSegments] = useState(1);
  const [participants, setParticipants] = useState(1);
  const service = services.find((item) => item.id === serviceId);
  const effectiveStart = Math.max(Date.now(), new Date(nominee.requestedStartsAt).getTime());
  const remainingMinutes = Math.max(0, Math.floor((new Date(nominee.requestedServiceEndsAt).getTime() - effectiveStart) / 60_000));
  const minimumSegments = service?.durationMinutes ? Math.ceil(service.durationMinutes / catalog.settings.segmentMinutes) : 1;
  const maxSegments = Math.max(0, Math.floor(remainingMinutes / catalog.settings.segmentMinutes));
  const safeSegments = Math.max(minimumSegments, Math.min(segments, maxSegments || minimumSegments));
  const duration = service?.durationMinutes || safeSegments * catalog.settings.segmentMinutes;
  const unit = service ? Number(service.price) + Math.max(0, participants - 1) * Number(service.additionalPersonPrice || 0) : 0;
  const total = service ? unit * (service.durationMinutes ? 1 : safeSegments) : 0;
  useEffect(() => { setServiceId(services[0]?.id || ''); setSegments(1); setParticipants(1); }, [nominee.id]);
  useEffect(() => { if (service) setSegments(service.durationMinutes ? Math.ceil(service.durationMinutes / catalog.settings.segmentMinutes) : 1); }, [serviceId]);
  if (!services.length || remainingMinutes < catalog.settings.segmentMinutes) return <small className="addonUnavailable">目前剩餘時段不足，請洽店員另開指名訂單。</small>;
  return <div className="customerAddonComposer"><button type="button" onClick={() => setOpen(!open)}>{open ? '收起加購' : '＋ 在此指名時段追加服務'}</button>{open ? <div><p>剩餘可用約 <strong>{remainingMinutes} 分鐘</strong>；不再收基礎指名費，也不延長原結束時間。</p><label>服務<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{services.map((item) => <option key={item.id} value={item.id}>{item.serviceName}｜{money(item.price)}{item.durationMinutes ? `／${item.durationMinutes} 分鐘` : '／節'}</option>)}</select></label><div className="addonControlRow"><label>節數<input type="number" min={minimumSegments} max={maxSegments} disabled={Boolean(service?.durationMinutes)} value={safeSegments} onChange={(event) => setSegments(Number(event.target.value))} /></label><label>參與人數<input type="number" min="1" max="20" value={participants} onChange={(event) => setParticipants(Number(event.target.value))} /></label></div>{service?.priceText ? <small className="addonPriceRange">店員標示價格：{service.priceText}</small> : null}<footer><span>占用 {duration} 分鐘</span><strong>{money(total)}</strong><button type="button" disabled={loading || !service || duration > remainingMinutes} onClick={() => onAddon({ parentNomineeId: nominee.id, serviceId, segmentCount: safeSegments, participantCount: participants })}>送出加購服務單</button></footer></div> : null}</div>;
}

function HelpPage({ currentGameId, onRecover, loading }) {
  const [form, setForm] = useState({ gameId: currentGameId || '', recoveryCode: '' });
  return <div className="orderPage"><PageHeading kicker="STAFF ASSIST" title="請洽店員" text="點餐碼遺失時，店員可依遊戲 ID 找到今日資料並提供六位數協助碼。" />
    <section className="helpCard"><div className="helpIndex">?</div><div><h2>找回今天的點餐碼</h2><p>為避免他人只知道遊戲 ID 就冒用點餐，仍需由店員確認後提供協助碼。</p></div><form onSubmit={(event) => { event.preventDefault(); onRecover(form.gameId.trim(), form.recoveryCode.trim()); }}><label>顧客遊戲 ID<input value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value })} required /></label><label>六位數店員協助碼<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.recoveryCode} onChange={(event) => setForm({ ...form, recoveryCode: event.target.value.replace(/\D/g, '') })} required /></label><button disabled={loading} type="submit">找回並刷新點餐 UI</button></form></section>
  </div>;
}

function PageHeading({ kicker, title, text }) { return <header className="orderPageHeading"><span>{kicker}</span><h1>{title}</h1><p>{text}</p></header>; }
function EmptyState({ title, text }) { return <div className="orderEmpty"><span>LD</span><h2>{title}</h2><p>{text}</p></div>; }
