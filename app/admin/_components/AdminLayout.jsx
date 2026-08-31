import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton } from './AdminShared.jsx';

const allItems = [
  { route: '/admin/home', label: '首頁設定', index: '01', roles: ['developer', 'manager'] },
  { route: '/admin/orders', label: '點單管理', index: '02', roles: ['developer', 'manager', 'clerk'] },
  { route: '/admin/staff', label: '店員設定', index: '03', roles: ['developer', 'manager', 'clerk'] },
  { route: '/admin/events', label: '活動設定', index: '04', roles: ['developer', 'manager'] },
  { route: '/admin/menu', label: '菜單設定', index: '05', roles: ['developer', 'manager'] },
];

export function AdminLayout({ route, navigate, children }) {
  const { user, logout } = useAdminAuth();
  const items = useMemo(() => allItems.filter((item) => item.roles.includes(user.role)), [user.role]);
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
          <span className="adminTopbarMark"><img src="/favicon.svg" alt="" /></span>
          <span className="adminTopbarBrandCopy"><strong>清醒夢</strong><small>LUCID DREAM / ADMIN</small></span>
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
          <button className={route === '/admin' ? 'isActive' : ''} type="button" onClick={() => handleNavigate('/admin')}>
            <span>00</span>後台首頁
          </button>
          {items.map((item) => (
            <button key={item.route} className={route === item.route ? 'isActive' : ''} type="button" onClick={() => handleNavigate(item.route)}>
              <span>{item.index}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="adminTopbarUtilities">
          <div className="adminAccount">
            <div className="adminAccountIdentity"><strong>{user.displayName}</strong><span>{user.roleLabel}</span></div>
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
