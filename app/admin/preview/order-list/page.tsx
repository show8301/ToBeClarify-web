const rows = [
  { id: "1", number: "LD-0901-018", customer: "Mizuki Yoru", gameId: "MIZUKI-021", time: "2026/9/1 22:41", status: "等待確認", tone: "submitted", total: "4,600 G" },
  { id: "2", number: "LD-0901-017", customer: "Aster Dawn", gameId: "ASTER-109", time: "2026/9/1 22:34", status: "服務中", tone: "in_service", total: "3,200 G" },
  { id: "3", number: "LD-0901-016", customer: "Noir Lune", gameId: "NOIR-404", time: "2026/9/1 22:26", status: "已成立", tone: "confirmed", total: "6,800 G" },
  { id: "4", number: "LD-0901-015", customer: "Rin Sora", gameId: "RIN-072", time: "2026/9/1 22:12", status: "已完成", tone: "completed", total: "2,400 G" },
  { id: "5", number: "LD-0901-014", customer: "Mizuki Yoru", gameId: "MIZUKI-021", time: "2026/9/1 21:58", status: "已完成", tone: "completed", total: "3,800 G" },
];

const navigation = [
  ["00", "點單管理"], ["01", "訂單列表"], ["02", "後台首頁"], ["03", "店員設定"],
  ["04", "菜單設定"], ["05", "活動設定"], ["06", "首頁設定"],
];

export default function AdminOrderListPreviewPage() {
  return <div className="adminTheme"><main className="adminShell adminMockShell">
    <aside className="adminTopbar">
      <div className="adminTopbarBrand"><span className="adminTopbarMark"><img src="/favicon.svg" alt="" /></span><span className="adminTopbarBrandCopy"><strong>清醒夢</strong><small>LUCID DREAM / ADMIN</small></span><button className="adminBackToSite adminBrandSiteLink" type="button">↗ 公開網站</button></div>
      <nav className="adminNav" aria-label="Mock 後台功能選單"><p className="adminNavLabel">工作區</p>{navigation.map(([index, label]) => <button className={label === "訂單列表" ? "isActive" : ""} key={index} type="button"><span>{index}</span>{label}</button>)}</nav>
      <div className="adminTopbarUtilities"><div className="adminAccount"><div className="adminAccountIdentity"><small>目前登入</small><strong>Zero</strong><span>開發者</span></div><button className="adminButton adminButton-ghost adminThemeToggle" type="button">☾</button><button className="adminButton adminButton-ghost" type="button">登出</button></div></div>
    </aside>
    <div className="adminWorkspace"><div className="adminContent"><section className="adminPage adminOrderListPage">
      <header className="adminPageHeading"><div><p className="eyebrow">ORDER HISTORY</p><h1>訂單列表</h1><p>依營業日查詢所有顧客訂單，快速核對狀態、金額與明細。</p></div><div className="adminPageActions"><button className="adminButton adminButton-secondary" type="button">重新整理</button></div></header>
      <section className="adminOrderListFilters"><label><span>營業日</span><input type="date" defaultValue="2026-09-01" /></label><label className="adminOrderListKeyword"><span>關鍵字</span><input placeholder="訂單編號、顧客名稱或遊戲 ID" /></label><label><span>訂單狀態</span><select defaultValue="all"><option value="all">全部狀態</option></select></label><div className="adminOrderListCount"><span>查詢結果</span><strong>18</strong><small>筆訂單</small></div></section>
      <div className="adminOrderListLayout"><section className="adminOrderListTableWrap"><table className="adminOrderListTable"><thead><tr><th>訂單編號</th><th>顧客</th><th>送出時間</th><th>狀態</th><th>金額</th><th>查看</th></tr></thead><tbody>{rows.map((row, index) => <tr className={index === 0 ? "isSelected" : ""} key={row.id}><td><strong>{row.number}</strong></td><td><strong>{row.customer}</strong><small>ID {row.gameId}</small></td><td>{row.time}</td><td><span className={`adminOrderStatus is-${row.tone}`}>{row.status}</span></td><td><strong>{row.total}</strong></td><td><button type="button">查看</button></td></tr>)}</tbody></table></section>
        <aside className="adminOrderListDetail"><header><div><span>訂單明細</span><h2>LD-0901-018</h2></div><button type="button">×</button></header><dl className="adminOrderDetailSummary"><div><dt>顧客</dt><dd>Mizuki Yoru<small>ID MIZUKI-021</small></dd></div><div><dt>狀態</dt><dd><span className="adminOrderStatus is-submitted">等待確認</span></dd></div><div><dt>送出時間</dt><dd>2026/9/1 22:41</dd></div><div><dt>訂單金額</dt><dd>4,600 G</dd></div></dl><section className="adminOrderDetailItems"><h3>訂購項目</h3><div><span><strong>月下特調</strong><small>數量 2</small></span><b>1,200 G</b></div><div><span><strong>凜 · 星夜陪伴</strong><small>2 節</small></span><b>3,000 G</b></div><div><span><strong>小費</strong><small>凜 60%／店家 40%</small></span><b>400 G</b></div></section><footer><span>小計 4,600 G</span><span>信物折抵 −600 G</span><strong>應付 4,000 G</strong></footer></aside>
      </div>
    </section></div></div>
  </main></div>;
}
