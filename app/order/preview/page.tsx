import "../ordering.css";
import "../ordering-modern.css";

const products = [
  { tag: "SIGNATURE", name: "月下特調", description: "藍柑橘、蝶豆花與清爽氣泡。", price: "600 G", tone: "isBlue" },
  { tag: "DESSERT", name: "星塵奶酪", description: "柔滑奶香與莓果星點。", price: "450 G", tone: "isPink" },
  { tag: "LIGHT MEAL", name: "旅人宵夜盤", description: "適合深夜分享的店舖小食。", price: "900 G", tone: "isMint" },
];

export default function OrderPreviewPage() {
  return <main className="orderShell orderMockShell">
    <header className="orderTopbar"><a href="#" className="orderBrand"><img src="/favicon.ico" alt="" /><span><strong>清醒夢</strong><small>LUCID DREAM / ORDER</small></span></a><div className="orderSessionChip"><span>今日點餐</span><strong>Mizuki Yoru</strong><small>ID MIZUKI-021</small></div><div className="orderCredit"><span>信物餐點餘額</span><strong>1,200 G</strong></div></header>
    <div className="orderBusinessBanner isOpen"><strong>目前可正常點餐</strong><span>預計接單至 01:30</span></div>
    <nav className="orderTabs" aria-label="點餐功能">{[["01", "一般點餐"], ["02", "指名服務"], ["03", "小費"], ["04", "本次點餐 2"], ["05", "我的訂單"]].map(([index, label], itemIndex) => <button className={itemIndex === 0 ? "isActive" : ""} key={label} type="button"><span>{index}</span>{label}</button>)}</nav>
    <section className="orderWorkspace"><div className="orderMain"><div className="orderPage"><header className="orderPageHeading"><span>FOOD &amp; DRINK</span><h1>一般點餐</h1><p>挑選今晚想享用的餐點。信物餘額只折抵餐點，剩餘額度可留到今天後續加點。</p></header>
      <div className="orderCategoryRail"><button className="isActive" type="button">推薦</button><button type="button">特調</button><button type="button">甜點</button><button type="button">宵夜</button></div>
      <div className="orderProductGrid">{products.map((product) => <article className="orderProductCard" key={product.name}><div className={`orderProductImage ${product.tone}`}><span>LD</span></div><div><small>{product.tag}</small><h2>{product.name}</h2><p>{product.description}</p></div><footer><strong>{product.price}</strong><button type="button"><span aria-hidden="true">＋</span>加入</button></footer></article>)}</div>
    </div></div><aside className="orderAside"><div><span>本次點餐</span><strong>2 項</strong></div><p>餐點與服務會在送出前集中確認。</p><dl><div><dt>小計</dt><dd>1,050 G</dd></div><div><dt>可折抵餐點</dt><dd>1,050 G</dd></div></dl><button type="button">查看明細與送出</button><button className="isSecondary" type="button">查看我的訂單</button></aside></section>
  </main>;
}
