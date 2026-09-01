const customers = [
  { name: "Mizuki Yoru", id: "MIZUKI-021", orders: 3, total: "8,400 Gil", active: true },
  { name: "Aster Dawn", id: "ASTER-109", orders: 1, total: "3,200 Gil" },
  { name: "Noir Lune", id: "NOIR-404", orders: 2, total: "6,800 Gil" },
  { name: "Rin Sora", id: "RIN-072", orders: 1, total: "2,400 Gil" },
];

const orders = [
  {
    number: "LD-0901-018",
    status: "等待店員確認",
    time: "22:41",
    total: "4,600 Gil",
    tone: "is-submitted",
    items: [
      ["餐點", "月下特調 × 2", "1,200 Gil"],
      ["指名服務", "凜｜星夜陪伴 2 節", "3,000 Gil"],
      ["小費", "凜 60%／店家 40%", "400 Gil"],
    ],
  },
  {
    number: "LD-0901-014",
    status: "服務進行中",
    time: "22:18",
    total: "3,800 Gil",
    tone: "is-in_service",
    items: [
      ["套餐", "旅人宵夜套餐 × 1", "1,800 Gil"],
      ["指名服務", "月詠｜純陪伴 1 節", "2,000 Gil"],
    ],
  },
];

export default function AdminPreviewPage() {
  return (
    <div className="adminTheme">
      <main className="adminShell adminMockShell">
        <aside className="adminTopbar">
          <div className="adminTopbarBrand">
            <span className="adminTopbarMark"><img src="/favicon.svg" alt="" /></span>
            <span className="adminTopbarBrandCopy"><strong>清醒夢</strong><small>LUCID DREAM</small></span>
            <button className="adminBackToSite adminBrandSiteLink" type="button">↗ 公開網站</button>
          </div>
          <nav className="adminNav" aria-label="Mock 後台功能選單">
            {[["營運操作", [["00", "點單管理"], ["01", "訂單列表"], ["02", "後台首頁"]]], ["內容與設定", [["03", "店員設定"], ["04", "菜單設定"], ["05", "活動設定"], ["06", "首頁設定"]]]].map(([group, items]) => <section className="adminNavGroup" key={group as string}><p className="adminNavLabel">{group as string}</p>{(items as string[][]).map(([index, label]) => <button className={label === "點單管理" ? "isActive" : ""} key={index} type="button"><span>{index}</span>{label}</button>)}</section>)}
          </nav>
          <div className="adminTopbarUtilities">
            <div className="adminAccount">
              <div className="adminAccountIdentity"><small>目前登入</small><strong>Zero</strong><span>開發者</span></div>
              <button className="adminButton adminButton-ghost adminThemeToggle" type="button">☾</button>
              <button className="adminButton adminButton-ghost" type="button">登出</button>
            </div>
          </div>
        </aside>

        <div className="adminWorkspace">
          <div className="adminContent">
            <section className="adminPage adminOrdersPage">
              <div className="adminPageHeading">
                <div>
                  <p className="eyebrow">ORDER OPERATIONS</p>
                  <h1>點單管理</h1>
                  <p>掌握今夜接單狀態、顧客訂單與指名服務排程。</p>
                </div>
                <div className="adminPageActions">
                  <button className="adminButton adminButton-secondary" type="button">營運參數</button>
                  <button className="adminButton adminButton-primary" type="button">＋ 開立點餐碼</button>
                </div>
              </div>

              <section className="adminBusinessOperations mode-coordination">
                <header>
                  <div><span>TONIGHT / LIVE</span><h2>今夜營業進行中</h2><p>目前採協調接單，送出後由店員確認是否承接。</p></div>
                  <dl>
                    <div><dt>營業狀態</dt><dd>接單中</dd></div>
                    <div><dt>預計結束</dt><dd>01:30</dd></div>
                    <div><dt>等待確認</dt><dd>3 筆訂單</dd></div>
                  </dl>
                </header>
                <div className="adminBusinessOperationsControls">
                  <button className="adminButton adminButton-primary" type="button">正常接單</button>
                  <button className="adminButton adminButton-secondary" type="button">協調接單</button>
                  <button className="adminButton adminButton-ghost" type="button">店員代送</button>
                </div>
              </section>

              <div className="adminMockStats" aria-label="今日營運摘要">
                <article><span>今日訂單</span><strong>18</strong><small>較上週同期 ＋4</small></article>
                <article><span>營業額</span><strong>48.6K</strong><small>GIL / TODAY</small></article>
                <article><span>服務中</span><strong>04</strong><small>2 位店員可接單</small></article>
                <article><span>平均等候</span><strong>08</strong><small>MINUTES</small></article>
              </div>

              <section className="adminOrderWorkspace adminMockOrderWorkspace">
                <aside className="adminMockCustomerPane">
                  <header><span>CUSTOMERS</span><strong>今日顧客</strong></header>
                  <label className="adminMockSearch"><span>搜尋</span><input defaultValue="" placeholder="名稱或遊戲 ID" /></label>
                  <div className="adminMockCustomerList">
                    {customers.map((customer) => (
                      <button className={customer.active ? "isActive" : ""} key={customer.id} type="button">
                        <span className="adminMockAvatar">{customer.name.slice(0, 1)}</span>
                        <span><strong>{customer.name}</strong><small>{customer.id} · {customer.orders} 筆</small></span>
                        <b>{customer.total}</b>
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="adminOrderDetailPane">
                  <section className="adminSelectedCustomer">
                    <div><span>SELECTED CUSTOMER</span><h2>Mizuki Yoru</h2><p>MIZUKI-021 · 今日第 3 次點餐</p></div>
                    <dl><div><dt>信物餘額</dt><dd>1,200 Gil</dd></div><div><dt>累計消費</dt><dd>8,400 Gil</dd></div></dl>
                  </section>
                  <div className="adminMockSectionHeading"><div><span>ORDER QUEUE</span><h2>訂單佇列</h2></div><button className="adminButton adminButton-secondary" type="button">＋ 店員代開單</button></div>
                  <div className="adminOrderCards">
                    {orders.map((order, orderIndex) => (
                      <article className={`adminOrderCard ${order.tone}`} key={order.number}>
                        <button className="adminOrderCardHead" type="button">
                          <div><span>{order.number}</span><strong>{order.status}</strong></div>
                          <div><small>送出 {order.time}</small><b>{order.total}</b></div>
                        </button>
                        {orderIndex === 0 ? <div className="adminOrderCardBody">
                          <div className="adminOrderItemList">
                            {order.items.map(([type, name, price]) => <div key={name}><span><small>{type}</small><strong>{name}</strong></span><b>{price}</b><button type="button">編輯</button></div>)}
                          </div>
                          <div className="adminOrderTransitions">
                            <label>狀態操作原因<input placeholder="取消、退回或提早完成時填寫" /></label>
                            <div><button className="adminButton adminButton-primary" type="button">接受訂單</button><button className="adminButton adminButton-secondary" type="button">要求改期</button><button className="adminButton adminButton-danger" type="button">取消訂單</button></div>
                          </div>
                          <div className="adminOrderTotals"><span>信物折抵 600 Gil</span><strong>應付 4,000 Gil</strong></div>
                        </div> : null}
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
