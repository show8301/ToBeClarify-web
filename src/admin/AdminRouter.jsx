import { useEffect } from 'react';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext.jsx';
import { AdminHomePage } from './AdminHomePage.jsx';
import { AdminLoginPage } from './AdminLoginPage.jsx';

export function AdminRouter({ route, navigate }) {
  return (
    <AdminAuthProvider>
      <AdminRouteView route={route} navigate={navigate} />
    </AdminAuthProvider>
  );
}

function AdminRouteView({ route, navigate }) {
  const { loading, user, error } = useAdminAuth();

  useEffect(() => {
    if (!loading && route === '/admin/login' && user) navigate('/admin');
    if (!loading && route !== '/admin/login' && !user) navigate('/admin/login');
  }, [loading, navigate, route, user]);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} />;
  if (route === '/admin/login') return user ? null : <AdminLoginPage navigate={navigate} />;
  return user ? <AdminHomePage navigate={navigate} /> : null;
}

function AdminLoading() {
  return (
    <main className="adminState" role="status">
      <div className="adminStateMark">35</div>
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
