import brandMark from '../assets/brand-mark.svg';
import { useAdminAuth } from './AdminAuthContext.jsx';

export function AdminHomePage({ navigate }) {
  const { user, logout } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <main className="adminShell">
      <header className="adminTopbar">
        <div className="adminTopbarBrand">
          <span className="adminTopbarMark"><img src={brandMark} alt="" /></span>
          <span>
            <strong>35女王古殿</strong>
            <small>ADMIN LOUNGE</small>
          </span>
        </div>
        <div className="adminAccount">
          <div>
            <strong>{user.displayName}</strong>
            <span>{user.roleLabel}</span>
          </div>
          <button className="adminGhostButton" type="button" onClick={handleLogout}>登出</button>
        </div>
      </header>

      <section className="adminHero">
        <p className="eyebrow">Management Console</p>
        <h1>歡迎回到後台，{user.displayName}</h1>
        <p>這裡將逐步整理店舖內容、營運流程與工作人員作業。</p>
        <span className="adminRoleBadge">目前身份：{user.roleLabel}</span>
      </section>

      <section className="adminModuleGrid" aria-label="後台功能模組">
        <article className="adminModuleCard isReady">
          <span className="adminModuleIndex">01</span>
          <p className="eyebrow">Session</p>
          <h2>登入狀態</h2>
          <p>目前已透過安全 Cookie 完成身份驗證。</p>
          <span className="adminModuleStatus">已啟用</span>
        </article>
        <article className="adminModuleCard">
          <span className="adminModuleIndex">02</span>
          <p className="eyebrow">Coming Soon</p>
          <h2>內容管理</h2>
          <p>首頁、活動、菜單與店員資料管理將在後續階段加入。</p>
          <span className="adminModuleStatus">準備中</span>
        </article>
        <article className="adminModuleCard">
          <span className="adminModuleIndex">03</span>
          <p className="eyebrow">Coming Soon</p>
          <h2>營運工具</h2>
          <p>排班、訂單、包廂與薪資等功能將依序開發。</p>
          <span className="adminModuleStatus">準備中</span>
        </article>
      </section>
    </main>
  );
}
