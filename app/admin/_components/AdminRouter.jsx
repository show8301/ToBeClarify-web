import { useEffect } from 'react';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext.jsx';
import { AdminHomePage } from './AdminHomePage.jsx';
import { AdminLoginPage } from './AdminLoginPage.jsx';
import { AdminLayout } from './AdminLayout.jsx';
import { AdminHomeSettingsPage } from './AdminHomeSettingsPage.jsx';
import { AdminStaffSettingsPage } from './AdminStaffSettingsPage.jsx';
import { AdminEventsPage } from './AdminEventsPage.jsx';
import { AdminMenuPage } from './AdminMenuPage.jsx';

export function AdminRouter({ route, navigate }) {
  return (
    <AdminAuthProvider>
      <AdminRouteView route={route} navigate={navigate} />
    </AdminAuthProvider>
  );
}

function AdminRouteView({ route, navigate }) {
  const { loading, user, error } = useAdminAuth();
  const canManageAll = user?.role === 'developer' || user?.role === 'manager';
  const routeAllowed = route === '/admin' || route === '/admin/staff'
    || (canManageAll && ['/admin/home', '/admin/events', '/admin/menu'].includes(route));

  useEffect(() => {
    if (!loading && route === '/admin/login' && user) navigate('/admin');
    if (!loading && route !== '/admin/login' && !user) navigate('/admin/login');
    if (!loading && user && !routeAllowed) navigate('/admin/staff');
  }, [loading, navigate, route, routeAllowed, user]);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} />;
  if (route === '/admin/login') return user ? null : <AdminLoginPage navigate={navigate} />;
  if (!user) return null;

  if (!routeAllowed) return null;

  let page = <AdminHomePage navigate={navigate} />;
  if (route === '/admin/home') page = <AdminHomeSettingsPage />;
  if (route === '/admin/staff') page = <AdminStaffSettingsPage />;
  if (route === '/admin/events') page = <AdminEventsPage />;
  if (route === '/admin/menu') page = <AdminMenuPage />;
  return <AdminLayout route={route === '/admin' ? '/admin/home' : route} navigate={navigate}>{page}</AdminLayout>;
}

function AdminLoading() {
  return (
    <main className="adminState" role="status">
      <div className="adminStateMark">LD</div>
      <p>正在確認後台通行資格…</p>
    </main>
  );
}
function AdminError({ error }) {
  return (
    <main className="adminState adminStateError" role="alert">
      <div className="adminStateMark">!</div>
      <h1>後台暫時無法連線</h1>
      <p>{error.message}</p>
    </main>
  );
}
