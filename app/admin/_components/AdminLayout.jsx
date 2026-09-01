import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton } from './AdminShared.jsx';

const allGroups = [
  { label: '營運操作', items: [
    { route: '/admin/orders', label: '點單管理', index: '00', roles: ['developer', 'manager', 'clerk'] },
    { route: '/admin/order-list', label: '訂單列表', index: '01', roles: ['developer', 'manager', 'clerk'] },
    { route: '/admin', label: '營運總覽', index: '02', roles: ['developer', 'manager', 'clerk'] },
    { route: '/admin/staff', label: '店員管理', index: '03', roles: ['developer', 'manager', 'clerk'] },
  ] },
  { label: '內容與設定', items: [
    { route: '/admin/menu', label: '菜單設定', index: '04', roles: ['developer', 'manager'] },
    { route: '/admin/events', label: '活動設定', index: '05', roles: ['developer', 'manager'] },
    { route: '/admin/home', label: '首頁設定', index: '06', roles: ['developer', 'manager'] },
  ] },
];

export function AdminLayout({ route, navigate, children }) {
  const { user, logout } = useAdminAuth();
  const groups = useMemo(() => allGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(user.role)) })).filter((group) => group.items.length), [user.role]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    try {
      setIsDarkMode(window.localStorage.getItem('lucid-dream-admin-theme') === 'dark');
    } catch {
      setIsDarkMode(false);
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.adminTheme = isDarkMode ? 'dark' : 'light';
    try {
      window.localStorage.setItem('lucid-dream-admin-theme', isDarkMode ? 'dark' : 'light');
    } catch {
      // The current session still follows the selected theme without persistence.
    }
  }, [isDarkMode, themeReady]);

  const handleNavigate = (nextRoute) => {
    navigate(nextRoute);
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    handleNavigate('/admin/login');
  };

  return (
    <main className="adminShell">
      <header className={`adminTopbar ${isMenuOpen ? 'isMenuOpen' : ''}`.trim()}>
        <div className="adminTopbarBrand">
          <span className="adminTopbarMark"><img src="/favicon.ico" alt="" /></span>
          <span className="adminTopbarBrandCopy"><strong>清醒夢</strong><small>LUCID DREAM</small></span>
          <button className="adminBackToSite adminBrandSiteLink" type="button" onClick={() => handleNavigate('/home')}>↗ 公開網站</button>
        </div>
        <button
          className="adminMenuButton"
          type="button"
          aria-label="切換後台導覽選單"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`adminNav ${isMenuOpen ? 'isOpen' : ''}`} aria-label="後台功能選單">
          {groups.map((group) => <section className="adminNavGroup" key={group.label}>
            <p className="adminNavLabel">{group.label}</p>
            {group.items.map((item) => <button key={item.route} className={route === item.route ? 'isActive' : ''} aria-current={route === item.route ? 'page' : undefined} type="button" onClick={() => handleNavigate(item.route)}><span>{item.index}</span>{item.label}</button>)}
          </section>)}
        </nav>
        <div className="adminTopbarUtilities">
          <div className="adminAccount">
            <div className="adminAccountIdentity"><small>目前登入</small><strong>{user.displayName}</strong><span>{user.roleLabel}</span></div>
            <AdminButton
              variant="ghost"
              className="adminThemeToggle"
              aria-pressed={isDarkMode}
              aria-label={isDarkMode ? '切換為淺色模式' : '切換為暗色模式'}
              title={isDarkMode ? '切換為淺色模式' : '切換為暗色模式'}
              disabled={!themeReady}
              onClick={() => setIsDarkMode((current) => !current)}
            >
              {isDarkMode ? '☀' : '☾'}
            </AdminButton>
            <AdminButton variant="ghost" onClick={handleLogout}>登出</AdminButton>
          </div>
        </div>
      </header>

      <div className="adminWorkspace">
        <div className="adminContent">{children}</div>
      </div>
    </main>
  );
}
