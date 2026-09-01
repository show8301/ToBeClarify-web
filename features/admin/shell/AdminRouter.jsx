import { useEffect } from 'react';
import { AdminAuthProvider, useAdminAuth } from '@/features/admin/auth/AdminAuthContext.jsx';
import { AdminHomePage } from '@/features/admin/dashboard/AdminHomePage.jsx';
import { AdminLoginPage } from '@/features/admin/auth/AdminLoginPage.jsx';
import { AdminForgotPasswordPage } from '@/features/admin/auth/AdminForgotPasswordPage.jsx';
import { AdminLayout } from '@/features/admin/layout/AdminLayout.jsx';
import { AdminHomeSettingsPage } from '@/features/admin/home/AdminHomeSettingsPage.jsx';
import { AdminStaffSettingsPage } from '@/features/admin/staff/AdminStaffSettingsPage.jsx';
import { AdminEventsPage } from '@/features/admin/events/AdminEventsPage.jsx';
import { AdminMenuPage } from '@/features/admin/menu/AdminMenuPage.jsx';
import { AdminOrdersPage } from '@/features/admin/orders/AdminOrdersPage.jsx';

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
  const isPasswordRecoveryRoute = route === '/admin/forgot-password';
  const isAnonymousAuthRoute = route === '/admin/login' || isPasswordRecoveryRoute;
  const routeAllowed = route === '/admin' || route === '/admin/staff' || route === '/admin/orders'
    || (canManageAll && ['/admin/home', '/admin/events', '/admin/menu'].includes(route));

  useEffect(() => {
    if (!loading && route === '/admin/login' && user) navigate('/admin');
    if (!loading && !isAnonymousAuthRoute && !user) navigate('/admin/login');
    if (!loading && user && !isAnonymousAuthRoute && !routeAllowed) navigate('/admin/staff');
  }, [isAnonymousAuthRoute, loading, navigate, route, routeAllowed, user]);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} />;
  if (route === '/admin/login') return user ? null : <AdminLoginPage navigate={navigate} />;
  if (isPasswordRecoveryRoute) return <AdminForgotPasswordPage navigate={navigate} />;
  if (!user) return null;

  if (!routeAllowed) return null;

  let page = <AdminHomePage navigate={navigate} />;
  if (route === '/admin/home') page = <AdminHomeSettingsPage />;
  if (route === '/admin/staff') page = <AdminStaffSettingsPage />;
  if (route === '/admin/events') page = <AdminEventsPage />;
  if (route === '/admin/menu') page = <AdminMenuPage />;
  if (route === '/admin/orders') page = <AdminOrdersPage />;
  return <AdminLayout route={route} navigate={navigate}>{page}</AdminLayout>;
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
