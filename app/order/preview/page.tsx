"use client";

import { useState } from "react";
import "../../../styles/ordering/site.css";

const products = [
  { id: "moon", category: "特調", tag: "SIGNATURE", name: "月下特調", description: "藍柑橘、蝶豆花與清爽氣泡。", price: 600, tone: "isBlue" },
  { id: "panna", category: "甜點", tag: "DESSERT", name: "星塵奶酪", description: "柔滑奶香與莓果星點。", price: 450, tone: "isPink" },
  { id: "night", category: "宵夜", tag: "LIGHT MEAL", name: "旅人宵夜盤", description: "適合深夜分享的店舖小食。", price: 900, tone: "isMint" },
];

const tabs = [["meal", "一般點餐"], ["nomination", "指名服務"], ["tip", "小費"], ["cart", "本次點餐"], ["orders", "我的訂單"]] as const;
const money = (value: number) => `${value.toLocaleString("zh-TW")} G`;

export default function OrderPreviewPage() {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("meal");
  const [category, setCategory] = useState("推薦");
  const [cart, setCart] = useState<Record<string, number>>({ moon: 1, panna: 1 });
  const [nominee, setNominee] = useState("凜 RIN");
  const [tip, setTip] = useState(500);
  const [notice, setNotice] = useState("");
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const subtotal = products.reduce((sum, product) => sum + product.price * (cart[product.id] || 0), 0);
  const credit = Math.min(1200, subtotal);
  const visibleProducts = category === "推薦" ? products : products.filter((product) => product.category === category);

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

  return <main className="orderShell orderMockShell">
    <header className="orderTopbar"><a href="/" className="orderBrand"><img src="/favicon.ico" alt="" /><span><strong>清醒夢</strong><small>LUCID DREAM / ORDER</small></span></a><div className="orderSessionChip"><span>今日點餐</span><strong>Mizuki Yoru</strong><small>ID MIZUKI-021</small></div><div className="orderCredit"><span>信物餐點餘額</span><strong>1,200 G</strong></div></header>
    <div className="orderBusinessBanner isOpen"><strong>目前可正常點餐</strong><span>預計接單至 01:30</span></div>
    {notice ? <div className="orderNotice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div> : null}
    <nav className="orderTabs" aria-label="點餐功能">{tabs.map(([key, label], index) => <button className={tab === key ? "isActive" : ""} key={key} type="button" onClick={() => setTab(key)}><span>{String(index + 1).padStart(2, "0")}</span>{label}{key === "cart" && cartCount ? ` ${cartCount}` : ""}</button>)}</nav>
    <section className="orderWorkspace"><div className="orderMain"><div className="orderPage">
      {tab === "meal" ? <><PageHeading eyebrow="FOOD & DRINK" title="一般點餐">挑選今晚想享用的餐點。信物餘額只折抵餐點，剩餘額度可留到今天後續加點。</PageHeading><div className="orderCategoryRail">{["推薦", "特調", "甜點", "宵夜"].map((item) => <button className={category === item ? "isActive" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="orderProductGrid">{visibleProducts.map((product) => <article className="orderProductCard" key={product.id}><div className={`orderProductImage ${product.tone}`}><span>LD</span></div><div><small>{product.tag}</small><h2>{product.name}</h2><p>{product.description}</p></div><footer><strong>{money(product.price)}</strong><button type="button" onClick={() => addProduct(product.id)}><span aria-hidden="true">＋</span>加入{cart[product.id] ? ` ${cart[product.id]}` : ""}</button></footer></article>)}</div></> : null}
      {tab === "nomination" ? <><PageHeading eyebrow="NOMINATION" title="指名服務">選擇今晚希望陪伴你的店員，送出後仍需由店員確認。</PageHeading><section className="nominationSection"><header><span>01</span><div><h2>選擇店員</h2><p>點擊卡片即可切換人選。</p></div></header><div className="nominationStaffGrid">{["凜 RIN", "菲菜", "Mika"].map((name) => <button type="button" className={nominee === name ? "isActive" : ""} key={name} onClick={() => setNominee(name)}><span>{name.slice(0, 1)}</span><strong>{name}</strong><small>可接受指名</small></button>)}</div></section><section className="nominationComposer"><div><span>SELECTED STAFF</span><h2>{nominee}</h2></div><p>星夜陪伴 · 2 節，預估費用 3,000 G。</p><button className="orderPrimaryAction" type="button" onClick={() => { setNotice("指名服務已加入本次點餐"); setTab("cart"); }}>加入本次點餐</button></section></> : null}
      {tab === "tip" ? <><PageHeading eyebrow="GRATUITY" title="小費">選擇想交給店員的小費金額。</PageHeading><section className="tipComposer"><h2>給 {nominee} 的小費</h2><div className="tipAmountButtons">{[200, 500, 1000, 2000].map((amount) => <button type="button" className={tip === amount ? "isActive" : ""} key={amount} onClick={() => setTip(amount)}>{money(amount)}</button>)}</div><div className="tipResult"><span>本次小費</span><strong>{money(tip)}</strong></div><button className="orderPrimaryAction" type="button" onClick={() => { setNotice(`已加入 ${money(tip)} 小費`); setTab("cart"); }}>加入本次點餐</button></section></> : null}
      {tab === "cart" ? <><PageHeading eyebrow="ORDER REVIEW" title="本次點餐">送出前再確認品項與金額。餐點會優先使用今日信物餘額折抵。</PageHeading><div className="cartLayout orderMockCartLayout"><div className="cartLines">{products.filter((product) => cart[product.id]).map((product) => <article className="cartLine" key={product.id}><span>餐點</span><div><strong>{product.name}</strong><small>{money(product.price)} × {cart[product.id]}</small></div><b>{money(product.price * cart[product.id])}</b><button type="button" aria-label={`移除${product.name}`} onClick={() => removeProduct(product.id)}>×</button></article>)}{cartCount === 0 ? <div className="orderEmpty"><span>LD</span><h2>尚未加入餐點</h2><p>回到一般點餐挑選餐點。</p></div> : null}</div><aside className="cartSummary"><h2>金額確認</h2><dl><div><dt>餐點</dt><dd>{money(subtotal)}</dd></div><div className="isCredit"><dt>信物餐點折抵</dt><dd>−{money(credit)}</dd></div><div className="isTotal"><dt>應付金額</dt><dd>{money(subtotal - credit)}</dd></div></dl><p>這是操作預覽，不會建立真實訂單。</p><button type="button" disabled={!cartCount} onClick={() => setNotice("預覽完成：訂單已模擬送出")}>確認並送出訂單</button></aside></div></> : null}
      {tab === "orders" ? <><PageHeading eyebrow="ORDER HISTORY" title="我的訂單">查看今天送出的訂單與目前處理狀態。</PageHeading><div className="myOrderList"><article className="myOrderCard"><button className="myOrderHead" type="button"><div><span>#LD-0921</span><strong>餐點訂單</strong><small>今晚 22:48 送出</small></div><div><b>1,050 G</b><small>準備中</small></div></button></article></div></> : null}
    </div></div><aside className="orderAside"><div><span>本次點餐</span><strong>{cartCount} 項</strong></div><p>餐點與服務會在送出前集中確認。</p><dl><div><dt>小計</dt><dd>{money(subtotal)}</dd></div><div><dt>可折抵餐點</dt><dd>{money(credit)}</dd></div></dl><button type="button" onClick={() => setTab("cart")}>查看明細與送出</button><button className="isSecondary" type="button" onClick={() => setTab("orders")}>查看我的訂單</button></aside></section>
  </main>;
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="orderPageHeading"><span>{eyebrow}</span><h1>{title}</h1><p>{children}</p></header>;
}
