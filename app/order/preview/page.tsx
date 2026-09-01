"use client";

import { useEffect, useState } from "react";
import "../../../styles/ordering/site.css";

const products = [
  { id: "moon", category: "特調", tag: "SIGNATURE", name: "月下特調", description: "藍柑橘、蝶豆花與清爽氣泡。", price: 600, tone: "isBlue" },
  { id: "panna", category: "甜點", tag: "DESSERT", name: "星塵奶酪", description: "柔滑奶香與莓果星點。", price: 450, tone: "isPink" },
  { id: "night", category: "宵夜", tag: "LIGHT MEAL", name: "旅人宵夜盤", description: "適合深夜分享的店舖小食。", price: 900, tone: "isMint" },
];

const scenarios = [
  { id: "unwind", title: "先放鬆一下", detail: "清爽特調，適合慢慢進入今晚。", category: "特調" },
  { id: "sweet", title: "想吃點甜的", detail: "用一份甜點替今晚加點儀式感。", category: "甜點" },
  { id: "hungry", title: "深夜有點餓", detail: "先找份能分享、也有飽足感的小食。", category: "宵夜" },
  { id: "company", title: "想找人陪伴", detail: "看看今晚可預約的店員與服務。", category: "服務" },
] as const;

const services = [
  { id: "talk", name: "星夜陪伴", description: "一起聊天、小酌，讓今晚有人陪你慢慢度過。", duration: "2 節 · 約 40 分鐘", price: 3000 },
  { id: "game", name: "桌遊同樂", description: "由店員依人數與氣氛推薦適合的桌遊。", duration: "2 節 · 約 40 分鐘", price: 2600 },
  { id: "drink", name: "專屬特調推薦", description: "聊聊今天的心情，由店員替你挑選一杯酒。", duration: "1 節 · 約 20 分鐘", price: 1600 },
] as const;

const staff = [
  { id: "dcd49fb5-cacf-4447-9471-8a75950a4a8c", displayName: "塔克西跩佛", roleTitle: "夢境主理人", avatarUrl: "https://api.marchgroup.net/api/client/media/3b15f04a-5c5f-4704-9263-7e7698abf44d?variant=card" },
  { id: "6ab4f2d2-44b1-4c9c-bb83-5c8cf45ca3a4", displayName: "琳感菇", roleTitle: "服務生／社恐", avatarUrl: "https://api.marchgroup.net/api/client/media/637de5aa-82a4-4952-8ccd-e77d7ee698b7?variant=card" },
  { id: "eced5fc8-faea-4e0c-8e24-92f68085037a", displayName: "破道之九十", roleTitle: "服務生／水產品", avatarUrl: "https://api.marchgroup.net/api/client/media/a467b1df-b493-465e-9610-23969cea650c?variant=card" },
] as const;

const tabs = [["meal", "一般點餐"], ["nomination", "指名服務"], ["tip", "小費"], ["cart", "本次點餐"], ["orders", "我的訂單"]] as const;
const money = (value: number) => `${value.toLocaleString("zh-TW")} G`;

export default function OrderPreviewPage() {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("meal");
  const [category, setCategory] = useState("推薦");
  const [scenario, setScenario] = useState<(typeof scenarios)[number]["id"]>("unwind");
  const [cart, setCart] = useState<Record<string, number>>({ moon: 1, panna: 1 });
  const [nomineeId, setNomineeId] = useState<(typeof staff)[number]["id"]>(staff[0].id);
  const [profileStaffId, setProfileStaffId] = useState<(typeof staff)[number]["id"] | null>(null);
  const [profileFrameLoaded, setProfileFrameLoaded] = useState(false);
  const [serviceId, setServiceId] = useState<(typeof services)[number]["id"]>("talk");
  const [serviceTime, setServiceTime] = useState("23:20");
  const [serviceAdded, setServiceAdded] = useState(false);
  const [tip, setTip] = useState(500);
  const [tipAdded, setTipAdded] = useState(false);
  const [notice, setNotice] = useState("");
  const nominee = staff.find((person) => person.id === nomineeId) || staff[0];
  const profileStaff = staff.find((person) => person.id === profileStaffId) || null;
  const mealCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const mealSubtotal = products.reduce((sum, product) => sum + product.price * (cart[product.id] || 0), 0);
  const selectedService = services.find((service) => service.id === serviceId) || services[0];
  const subtotal = mealSubtotal + (serviceAdded ? selectedService.price : 0) + (tipAdded ? tip : 0);
  const cartCount = mealCount + Number(serviceAdded) + Number(tipAdded);
  const credit = Math.min(1200, mealSubtotal);
  const selectedScenario = scenarios.find((item) => item.id === scenario) || scenarios[0];
  const visibleProducts = category === "推薦" ? products.filter((product) => product.category === selectedScenario.category) : products.filter((product) => product.category === category);

  const addProduct = (id: string) => {
    setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
    setNotice("已加入本次點餐");
  };
  const removeProduct = (id: string) => setCart((current) => {
    const next = { ...current };
    if ((next[id] || 0) <= 1) delete next[id];
    else next[id] -= 1;
    return next;
  });

  useEffect(() => {
    if (!profileStaff) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setProfileStaffId(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [profileStaff]);

  return <main className="orderShell orderMockShell">
    <header className="orderTopbar"><a href="/" className="orderBrand"><img src="/favicon.ico" alt="" /><span><strong>清醒夢</strong><small>LUCID DREAM / ORDER</small></span></a><div className="orderSessionChip"><span>今日點餐</span><strong>Mizuki Yoru</strong><small>ID MIZUKI-021</small></div><div className="orderCredit"><span>信物餐點餘額</span><strong>1,200 G</strong></div></header>
    <div className="orderBusinessBanner isOpen"><strong>目前可正常點餐</strong><span>預計接單至 01:30</span></div>
    {notice ? <div className="orderNotice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div> : null}
    <nav className="orderTabs" aria-label="點餐功能">{tabs.map(([key, label], index) => <button className={tab === key ? "isActive" : ""} key={key} type="button" onClick={() => setTab(key)}><span>{String(index + 1).padStart(2, "0")}</span>{label}{key === "cart" && cartCount ? ` ${cartCount}` : ""}</button>)}</nav>
    <section className="orderWorkspace"><div className="orderMain"><div className="orderPage">
      {tab === "meal" ? <>
        <PageHeading eyebrow="TONIGHT'S MOOD" title="今晚想怎麼度過？">先選一個最接近現在心情的情境，我們再替你整理適合的餐點與服務。</PageHeading>
        <section className="orderScenarioGuide" aria-label="選擇今晚的情境">
          {scenarios.map((item, index) => <button className={scenario === item.id ? "isActive" : ""} type="button" key={item.id} onClick={() => { setScenario(item.id); if (item.category === "服務") setTab("nomination"); else setCategory("推薦"); }}><span>0{index + 1}</span><strong>{item.title}</strong><small>{item.detail}</small><b aria-hidden="true">→</b></button>)}
        </section>
        <div className="orderRecommendationHead"><div><span>RECOMMENDED</span><h2>{selectedScenario.title}，可以從這裡開始</h2></div><p>也可以直接切換分類查看全部餐點。</p></div>
        <div className="orderCategoryRail">{["推薦", "特調", "甜點", "宵夜"].map((item) => <button className={category === item ? "isActive" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="orderProductGrid">{visibleProducts.map((product) => <article className="orderProductCard" key={product.id}><div className={`orderProductImage ${product.tone}`}><span>LD</span></div><div><small>{product.tag}</small><h2>{product.name}</h2><p>{product.description}</p></div><footer><strong>{money(product.price)}</strong><button type="button" onClick={() => addProduct(product.id)}><span aria-hidden="true">＋</span>加入{cart[product.id] ? ` ${cart[product.id]}` : ""}</button></footer></article>)}</div>
      </> : null}
      {tab === "nomination" ? <>
        <PageHeading eyebrow="STAFF SERVICE" title="今晚想要誰陪你？">依序選擇店員、服務內容與開始時間。送出後仍需由店員確認。</PageHeading>
        <section className="nominationSection"><header><span>01</span><div><h2>選擇店員</h2><p>點擊頭像選擇店員，或先查看完整人物介紹。</p></div></header><div className="nominationStaffGrid">{staff.map((person) => <article className={`orderStaffCard ${nomineeId === person.id ? "isActive" : ""}`} key={person.id}><button className="orderStaffSelect" type="button" onClick={() => setNomineeId(person.id)}><span><img src={person.avatarUrl} alt={`${person.displayName} 的頭像`} /></span><strong>{person.displayName}</strong><small>{person.roleTitle}</small></button><button className="orderStaffProfileButton" type="button" onClick={() => { setProfileFrameLoaded(false); setProfileStaffId(person.id); }}>查看介紹</button></article>)}</div></section>
        <section className="nominationSection"><header><span>02</span><div><h2>{nominee.displayName} 提供的服務</h2><p>選擇你今晚需要的陪伴方式。</p></div></header><div className="nominationServiceGrid">{services.map((service) => <button type="button" className={serviceId === service.id ? "isActive" : ""} key={service.id} onClick={() => setServiceId(service.id)}><span>SERVICE</span><strong>{service.name}</strong><p>{service.description}</p><footer><b>{money(service.price)}</b><small>{service.duration}</small></footer></button>)}</div></section>
        <section className="nominationComposer"><div><span>03 · CONFIRM</span><h2>{nominee.displayName} · {selectedService.name}</h2></div><div className="nominationControls"><label>希望開始時間<select value={serviceTime} onChange={(event) => setServiceTime(event.target.value)}><option>23:20</option><option>23:40</option><option>00:00</option></select></label><label>服務時間<strong>{selectedService.duration}</strong></label><label>預估費用<strong>{money(selectedService.price)}</strong></label></div><button className="orderPrimaryAction" type="button" onClick={() => { setServiceAdded(true); setNotice("指名服務已加入本次點餐"); setTab("cart"); }}>加入本次點餐</button></section>
      </> : null}
      {tab === "tip" ? <><PageHeading eyebrow="GRATUITY" title="小費">選擇想交給店員的小費金額。</PageHeading><section className="tipComposer"><h2>給 {nominee.displayName} 的小費</h2><div className="tipAmountButtons">{[200, 500, 1000, 2000].map((amount) => <button type="button" className={tip === amount ? "isActive" : ""} key={amount} onClick={() => setTip(amount)}>{money(amount)}</button>)}</div><div className="tipResult"><span>本次小費</span><strong>{money(tip)}</strong></div><button className="orderPrimaryAction" type="button" onClick={() => { setTipAdded(true); setNotice(`已加入 ${money(tip)} 小費`); setTab("cart"); }}>加入本次點餐</button></section></> : null}
      {tab === "cart" ? <><PageHeading eyebrow="ORDER REVIEW" title="本次點餐">送出前再確認餐點、店員服務與小費。餐點會優先使用今日信物餘額折抵。</PageHeading><div className="cartLayout orderMockCartLayout"><div className="cartLines">
        {products.filter((product) => cart[product.id]).map((product) => <article className="cartLine" key={product.id}><span>餐點</span><div><strong>{product.name}</strong><small>{money(product.price)} × {cart[product.id]}</small></div><b>{money(product.price * cart[product.id])}</b><button type="button" aria-label={`移除${product.name}`} onClick={() => removeProduct(product.id)}>×</button></article>)}
        {serviceAdded ? <article className="cartNominationGroup"><header><span>{selectedService.name}</span><small>{nominee.displayName}</small></header><div className="cartLine"><span>服務</span><div><strong>{selectedService.duration}</strong><small>預計 {serviceTime} 開始</small></div><b>{money(selectedService.price)}</b><button type="button" aria-label="移除指名服務" onClick={() => setServiceAdded(false)}>×</button></div></article> : null}
        {tipAdded ? <article className="cartLine"><span>小費</span><div><strong>給 {nominee.displayName}</strong><small>感謝今晚的服務</small></div><b>{money(tip)}</b><button type="button" aria-label="移除小費" onClick={() => setTipAdded(false)}>×</button></article> : null}
        {cartCount === 0 ? <div className="orderEmpty"><span>LD</span><h2>尚未加入內容</h2><p>回到情境引導挑選餐點或店員服務。</p></div> : null}
      </div><aside className="cartSummary"><h2>金額確認</h2><dl><div><dt>餐點、服務與小費</dt><dd>{money(subtotal)}</dd></div><div className="isCredit"><dt>信物餐點折抵</dt><dd>−{money(credit)}</dd></div><div className="isTotal"><dt>應付金額</dt><dd>{money(subtotal - credit)}</dd></div></dl><p>這是操作預覽，不會建立真實訂單。</p><button type="button" disabled={!cartCount} onClick={() => setNotice("預覽完成：訂單已模擬送出")}>確認並送出訂單</button></aside></div></> : null}
      {tab === "orders" ? <><PageHeading eyebrow="ORDER HISTORY" title="我的訂單">查看今天送出的訂單與目前處理狀態。</PageHeading><div className="myOrderList"><article className="myOrderCard"><button className="myOrderHead" type="button"><div><span>#LD-0921</span><strong>餐點訂單</strong><small>今晚 22:48 送出</small></div><div><b>1,050 G</b><small>準備中</small></div></button></article></div></> : null}
    </div></div><aside className="orderAside"><div><span>本次點餐</span><strong>{cartCount} 項</strong></div><p>餐點與服務會在送出前集中確認。</p><dl><div><dt>小計</dt><dd>{money(subtotal)}</dd></div><div><dt>可折抵餐點</dt><dd>{money(credit)}</dd></div></dl><button type="button" onClick={() => setTab("cart")}>查看明細與送出</button><button className="isSecondary" type="button" onClick={() => setTab("orders")}>查看我的訂單</button></aside></section>
    {profileStaff ? <div className="orderStaffModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileStaffId(null); }}><section className="orderStaffModal" role="dialog" aria-modal="true" aria-label={`${profileStaff.displayName} 的店員介紹`}><header><div><span>STAFF PROFILE</span><strong>{profileStaff.displayName}</strong><small>{profileStaff.roleTitle}</small></div><button type="button" aria-label="關閉店員介紹" onClick={() => setProfileStaffId(null)}>×</button></header><div className={`orderStaffFrame ${profileFrameLoaded ? "isLoaded" : ""}`}><div className="orderStaffFrameLoading" role="status"><span>LD</span><strong>正在載入店員介紹</strong></div><iframe src={`/staff/${profileStaff.id}?embed=order`} title={`${profileStaff.displayName} 的完整店員介紹`} onLoad={() => setProfileFrameLoaded(true)} /></div><footer><a href={`/staff/${profileStaff.id}`} target="_blank" rel="noreferrer">另開完整頁面 ↗</a><button type="button" onClick={() => { setNomineeId(profileStaff.id); setProfileStaffId(null); }}>選擇這位店員</button></footer></section></div> : null}
  </main>;
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="orderPageHeading"><span>{eyebrow}</span><h1>{title}</h1><p>{children}</p></header>;
}
