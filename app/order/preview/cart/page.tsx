import "../../ordering.css";
import "../../ordering-modern.css";

export default function OrderCartPreviewPage() {
  return <main className="orderShell orderMockShell">
    <header className="orderTopbar"><a href="#" className="orderBrand"><img src="/favicon.ico" alt="" /><span><strong>清醒夢</strong><small>LUCID DREAM / ORDER</small></span></a><div className="orderSessionChip"><span>今日點餐</span><strong>Mizuki Yoru</strong><small>ID MIZUKI-021</small></div><div className="orderCredit"><span>信物餐點餘額</span><strong>1,200 G</strong></div></header>
    <div className="orderBusinessBanner isOpen"><strong>目前可正常點餐</strong><span>預計接單至 01:30</span></div>
    <nav className="orderTabs" aria-label="點餐功能">{[["01", "一般點餐"], ["02", "指名服務"], ["03", "小費"], ["04", "本次點餐 3"], ["05", "我的訂單"]].map(([index, label], itemIndex) => <button className={itemIndex === 3 ? "isActive" : ""} key={label} type="button"><span>{index}</span>{label}</button>)}</nav>
    <section className="orderWorkspace"><div className="orderMain"><div className="orderPage"><header className="orderPageHeading"><span>ORDER REVIEW</span><h1>本次點餐</h1><p>送出前再確認品項與金額。餐點會優先使用今日信物餘額折抵。</p></header>
      <div className="cartLayout orderMockCartLayout"><div className="cartLines">
        <article className="cartLine"><span>餐點</span><div><strong>月下特調</strong><small>600 G × 1</small></div><b>600 G</b><button type="button" aria-label="移除月下特調">×</button></article>
        <article className="cartLine"><span>餐點</span><div><strong>星塵奶酪</strong><small>450 G × 1</small></div><b>450 G</b><button type="button" aria-label="移除星塵奶酪">×</button></article>
        <article className="cartNominationGroup"><header><span>指名服務</span><small>凜 RIN</small></header><div className="cartLine"><span>服務</span><div><strong>星夜陪伴 · 2 節</strong><small>預計 23:20 開始</small></div><b>3,000 G</b><button type="button" aria-label="移除指名服務">×</button></div></article>
      </div><aside className="cartSummary"><h2>金額確認</h2><dl><div><dt>餐點與服務</dt><dd>4,050 G</dd></div><div className="isCredit"><dt>信物餐點折抵</dt><dd>−1,050 G</dd></div><div className="isTotal"><dt>應付金額</dt><dd>3,000 G</dd></div></dl><p>指名服務需由店員確認後成立。</p><button type="button">確認並送出訂單</button></aside></div>
    </div></div></section>
  </main>;
}
