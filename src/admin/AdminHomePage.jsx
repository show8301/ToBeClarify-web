import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton, AdminPage, AdminPanel } from './AdminShared.jsx';
import buttonLeft from '../assets/button1.png';
import buttonRight from '../assets/button2.png';

function DashboardButton({ children, art, className = '', ...props }) {
  return (
    <AdminButton className={`adminDashboardButton ${className}`.trim()} {...props}>
      <img src={art} alt="" aria-hidden="true" />
      <span>{children}</span>
    </AdminButton>
  );
}

export function AdminHomePage({ navigate }) {
  const { user } = useAdminAuth();
  const canManageAll = user.role === 'developer' || user.role === 'manager';

  return (
    <AdminPage eyebrow="Management Console" title={`歡迎回到後台，${user.displayName}`} description={`目前身份：${user.roleLabel}`}>
      <div className="adminDashboardCards">
        <AdminPanel title="登入狀態" description="目前已透過安全 Cookie 完成身份驗證。"><span className="adminModuleStatus isReady">已啟用</span></AdminPanel>
        {canManageAll ? <>
          <AdminPanel title="首頁設定" description="維護店舖介紹、首頁規則與活動輪播。"><DashboardButton art={buttonLeft} onClick={() => navigate('/admin/home')}>進入設定</DashboardButton></AdminPanel>
          <AdminPanel title="活動與菜單" description="快速進入活動或菜單資料管理。"><div className="adminInlineActions"><DashboardButton art={buttonRight} onClick={() => navigate('/admin/events')}>活動設定</DashboardButton><DashboardButton art={buttonRight} onClick={() => navigate('/admin/menu')}>菜單設定</DashboardButton></div></AdminPanel>
        </> : <AdminPanel title="店員設定" description="維護自己的公開資料與服務內容。"><DashboardButton art={buttonLeft} onClick={() => navigate('/admin/staff')}>進入設定</DashboardButton></AdminPanel>}
      </div>
    </AdminPage>
  );
}
