import { useEffect, useState } from 'react';
import { adminApi } from '../admin-api.js';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton, AdminPage, AdminPanel, AdminToggle } from './AdminShared.jsx';

export function AdminHomePage({ navigate }) {
  const { user } = useAdminAuth();
  const canManageAll = user.role === 'developer' || user.role === 'manager';
  const canHideMenu = user.role === 'developer';
  const [visibility, setVisibility] = useState({ loading: canHideMenu, saving: false, menuHidden: false, error: '' });

  useEffect(() => {
    if (!canHideMenu) return undefined;
    let active = true;
    adminApi.getSiteSettings()
      .then((settings) => {
        if (!active) return;
        const setting = settings?.find((item) => item.settingKey === 'siteVisibility');
        const value = setting?.settingValue;
        setVisibility({ loading: false, saving: false, menuHidden: Boolean(value && typeof value === 'object' && value.menuHidden === true), error: '' });
      })
      .catch((error) => {
        if (active) setVisibility((current) => ({ ...current, loading: false, error: error?.message || '無法讀取公開網站顯示設定。' }));
      });
    return () => { active = false; };
  }, [canHideMenu]);

  const updateMenuVisibility = async (menuHidden) => {
    const previous = visibility.menuHidden;
    setVisibility((current) => ({ ...current, menuHidden, saving: true, error: '' }));
    try {
      await adminApi.saveSiteSetting('siteVisibility', {
        settingValue: { menuHidden },
        description: '公開網站 MENU 顯示設定',
        isActive: true,
      });
      setVisibility((current) => ({ ...current, saving: false }));
    } catch (error) {
      setVisibility((current) => ({ ...current, saving: false, menuHidden: previous, error: error?.message || '儲存公開網站顯示設定失敗。' }));
    }
  };

  return (
    <AdminPage eyebrow="Management Console" title={`歡迎回到後台，${user.displayName}`} description={`目前身份：${user.roleLabel}`} actions={<span className="adminPageLoginStatus" role="status">已登入</span>}>
      <div className="adminDashboardCards">
        {canManageAll ? <>
          <AdminPanel title="首頁設定" description="維護店舖介紹、首頁規則與活動輪播。"><AdminButton onClick={() => navigate('/admin/home')}>進入設定</AdminButton></AdminPanel>
          <AdminPanel title="活動與菜單" description="快速進入活動或菜單資料管理。"><div className="adminInlineActions"><AdminButton variant="secondary" onClick={() => navigate('/admin/events')}>活動設定</AdminButton><AdminButton variant="secondary" onClick={() => navigate('/admin/menu')}>菜單設定</AdminButton></div></AdminPanel>
        </> : <AdminPanel title="店員設定" description="維護自己的公開資料與服務內容。"><AdminButton onClick={() => navigate('/admin/staff')}>進入設定</AdminButton></AdminPanel>}
      </div>
      {canHideMenu ? <div className="adminDeveloperTools">
        <AdminPanel title="開發者功能" description="僅開發者可調整公開網站的實驗性顯示設定。">
          <AdminToggle checked={visibility.menuHidden} onChange={updateMenuVisibility} disabled={visibility.loading || visibility.saving} label="隱藏 MENU 功能" />
          {visibility.loading ? <small className="adminDeveloperToolState">讀取設定中…</small> : null}
          {visibility.saving ? <small className="adminDeveloperToolState">儲存中…</small> : null}
          {visibility.error ? <small className="adminDeveloperToolState isError">{visibility.error}</small> : null}
        </AdminPanel>
      </div> : null}
    </AdminPage>
  );
}
