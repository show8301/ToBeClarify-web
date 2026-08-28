import { useEffect, useState } from 'react';
import { adminApi } from '../admin-api.js';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton, AdminPage, AdminPanel, AdminToggle } from './AdminShared.jsx';

const PUBLIC_PAGES = [
  { key: 'home', number: '00', label: '首頁' },
  { key: 'staff', number: '01', label: '店員珍藏' },
  { key: 'gallery', number: '02', label: '艾歐澤亞週報' },
  { key: 'menu', number: '03', label: '佳餚名錄' },
  { key: 'guestbook', number: '04', label: '留聲機' },
  { key: 'liveUpdate', number: '05', label: '店舖動態' },
  { key: 'staffRanking', number: '06', label: '店員榜' },
  { key: 'monetaryRanking', number: '07', label: '消費榜' },
];

const defaultPageVisibility = Object.fromEntries(PUBLIC_PAGES.map((page) => [page.key, true]));
const STAFF_PAGE_SIZE = 20;

function normalizePageVisibility(value) {
  if (!value || typeof value !== 'object') return { ...defaultPageVisibility };
  const legacyMenuHidden = value.menuHidden === true;
  return {
    home: value.home !== false,
    staff: value.staff !== false,
    gallery: value.gallery !== false,
    menu: typeof value.menu === 'boolean' ? value.menu : !legacyMenuHidden,
    guestbook: value.guestbook !== false,
    liveUpdate: value.liveUpdate !== false,
    staffRanking: value.staffRanking !== false,
    monetaryRanking: value.monetaryRanking !== false,
  };
}

function normalizeStaffDirectory(value) {
  const items = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
  return items.map((item) => ({
    displayName: String(item?.displayName ?? item?.staffName ?? item?.name ?? '').trim(),
    loginName: String(item?.loginName ?? item?.staffAccount ?? item?.account ?? '').trim(),
    id: String(item?.id ?? item?.staffId ?? item?.staffID ?? item?.staffMemberId ?? item?.userId ?? item?.ID ?? '').trim(),
  })).filter((item) => item.displayName || item.loginName || item.id);
}

function DeveloperDisclosure({ title, description, contentId, open, onToggle, children }) {
  return (
    <details className="adminDeveloperDisclosure" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary className="adminDeveloperDisclosureSummary" aria-controls={contentId} aria-expanded={open}>
        <span><b>{title}</b><small>{description}</small></span>
        <i aria-hidden="true">⌄</i>
      </summary>
      <div id={contentId} className="adminDeveloperDisclosureBody">{children}</div>
    </details>
  );
}

export function AdminHomePage({ navigate }) {
  const { user } = useAdminAuth();
  const canManageAll = user.role === 'developer' || user.role === 'manager';
  const canHideMenu = user.role === 'developer';
  const [visibility, setVisibility] = useState({ loading: canHideMenu, saving: false, pages: { ...defaultPageVisibility }, error: '' });
  const [visibilityOpen, setVisibilityOpen] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState({ loading: canHideMenu, items: [], error: '' });
  const [staffDirectoryOpen, setStaffDirectoryOpen] = useState(true);
  const [staffDirectoryPage, setStaffDirectoryPage] = useState(1);

  useEffect(() => {
    if (!canHideMenu) return undefined;
    let active = true;
    adminApi.getSiteSettings()
      .then((settings) => {
        if (!active) return;
        const setting = settings?.find((item) => item.settingKey === 'siteVisibility');
        setVisibility({ loading: false, saving: false, pages: normalizePageVisibility(setting?.settingValue), error: '' });
      })
      .catch((error) => {
        if (active) setVisibility((current) => ({ ...current, loading: false, error: error?.message || '無法讀取公開網站顯示設定。' }));
      });
    return () => { active = false; };
  }, [canHideMenu]);

  useEffect(() => {
    if (!canHideMenu) return undefined;
    let active = true;
    setStaffDirectory({ loading: true, items: [], error: '' });
    adminApi.getAllStaffList()
      .then((items) => {
        if (!active) return;
        setStaffDirectory({ loading: false, items: normalizeStaffDirectory(items), error: '' });
        setStaffDirectoryPage(1);
      })
      .catch((error) => {
        if (active) setStaffDirectory({ loading: false, items: [], error: error?.message || '無法讀取使用者列表。' });
      });
    return () => { active = false; };
  }, [canHideMenu]);

  const updatePageVisibility = async (key, visible) => {
    const previous = visibility.pages;
    const pages = { ...previous, [key]: visible };
    setVisibility((current) => ({ ...current, pages, saving: true, error: '' }));
    try {
      await adminApi.saveSiteSetting('siteVisibility', {
        settingValue: pages,
        description: '公開網站各頁面顯示設定',
        isActive: true,
      });
      setVisibility((current) => ({ ...current, saving: false }));
    } catch (error) {
      setVisibility((current) => ({ ...current, saving: false, pages: previous, error: error?.message || '儲存公開網站顯示設定失敗。' }));
    }
  };

  const staffDirectoryTotalPages = Math.max(1, Math.ceil(staffDirectory.items.length / STAFF_PAGE_SIZE));
  const currentStaffDirectoryPage = Math.min(staffDirectoryPage, staffDirectoryTotalPages);
  const visibleStaffDirectory = staffDirectory.items.slice(
    (currentStaffDirectoryPage - 1) * STAFF_PAGE_SIZE,
    currentStaffDirectoryPage * STAFF_PAGE_SIZE,
  );

  return (
    <AdminPage eyebrow="Management Console" title={`歡迎回到後台，${user.displayName}`} description={`目前身份：${user.roleLabel}`} actions={<span className="adminPageLoginStatus" role="status">已登入</span>}>
      <div className="adminDashboardCards">
        {canManageAll ? <>
          <AdminPanel title="首頁設定" description="維護店舖介紹、首頁規則與活動輪播。"><AdminButton onClick={() => navigate('/admin/home')}>進入設定</AdminButton></AdminPanel>
          <AdminPanel title="活動與菜單" description="快速進入活動或菜單資料管理。"><div className="adminInlineActions"><AdminButton variant="secondary" onClick={() => navigate('/admin/events')}>活動設定</AdminButton><AdminButton variant="secondary" onClick={() => navigate('/admin/menu')}>菜單設定</AdminButton></div></AdminPanel>
        </> : <AdminPanel title="店員設定" description="維護自己的公開資料與服務內容。"><AdminButton onClick={() => navigate('/admin/staff')}>進入設定</AdminButton></AdminPanel>}
      </div>
      {canHideMenu ? <div className="adminDeveloperTools">
        <DeveloperDisclosure
          title="頁面顯示狀態"
          description="調整公開網站 MENU 中 00–07 各頁面的顯示狀態。"
          contentId="admin-page-visibility-content"
          open={visibilityOpen}
          onToggle={setVisibilityOpen}
        >
          <div className="adminPageVisibilityList">
            {PUBLIC_PAGES.map((page) => <div className="adminPageVisibilityRow" key={page.key}>
              <span><b>{page.number}</b>{page.label}</span>
              <AdminToggle checked={visibility.pages[page.key]} onChange={(value) => updatePageVisibility(page.key, value)} disabled={visibility.loading || visibility.saving} label={visibility.pages[page.key] ? '顯示' : '隱藏'} ariaLabel={`${page.number} ${page.label}`} />
            </div>)}
          </div>
          {visibility.loading ? <small className="adminDeveloperToolState">讀取設定中…</small> : null}
          {visibility.saving ? <small className="adminDeveloperToolState">儲存中…</small> : null}
          {visibility.error ? <small className="adminDeveloperToolState isError">{visibility.error}</small> : null}
        </DeveloperDisclosure>
        <DeveloperDisclosure
          title="使用者帳號列表"
          description="查看所有使用者的顯示名稱、店員帳號與店員 ID。"
          contentId="admin-staff-directory-content"
          open={staffDirectoryOpen}
          onToggle={setStaffDirectoryOpen}
        >
          {staffDirectory.loading ? <small className="adminDeveloperToolState">讀取使用者列表中…</small> : null}
          {staffDirectory.error ? <small className="adminDeveloperToolState isError">{staffDirectory.error}</small> : null}
          {!staffDirectory.loading && !staffDirectory.error ? <>
            {staffDirectory.items.length ? <div className="adminStaffDirectoryTableWrap">
              <table className="adminStaffDirectoryTable">
                <caption className="adminVisuallyHidden">所有使用者帳號列表</caption>
                <thead><tr><th scope="col">顯示名稱</th><th scope="col">店員帳號</th><th scope="col">店員ID</th></tr></thead>
                <tbody>{visibleStaffDirectory.map((item, index) => <tr key={`${item.id || item.loginName || item.displayName}-${index}`}>
                  <td>{item.displayName || '—'}</td>
                  <td>{item.loginName || '—'}</td>
                  <td><code>{item.id || '—'}</code></td>
                </tr>)}</tbody>
              </table>
            </div> : <p className="adminEmptyText">目前沒有使用者資料。</p>}
            {staffDirectory.items.length ? <div className="adminStaffDirectoryFooter">
              <small>共 {staffDirectory.items.length} 筆，每頁最多 {STAFF_PAGE_SIZE} 筆</small>
              <nav className="adminStaffDirectoryPagination" aria-label="使用者列表分頁">
                <AdminButton variant="ghost" disabled={currentStaffDirectoryPage === 1} onClick={() => setStaffDirectoryPage((page) => Math.max(1, page - 1))}>上一頁</AdminButton>
                <span>第 {currentStaffDirectoryPage} / {staffDirectoryTotalPages} 頁</span>
                <AdminButton variant="ghost" disabled={currentStaffDirectoryPage === staffDirectoryTotalPages} onClick={() => setStaffDirectoryPage((page) => Math.min(staffDirectoryTotalPages, page + 1))}>下一頁</AdminButton>
              </nav>
            </div> : null}
          </> : null}
        </DeveloperDisclosure>
      </div> : null}
    </AdminPage>
  );
}
