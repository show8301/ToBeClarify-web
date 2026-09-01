"use client";

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/features/admin/auth/AdminAuthContext.jsx';
import { AdminForgotPasswordPage } from '@/features/admin/auth/AdminForgotPasswordPage.jsx';
import { AdminLoginPage } from '@/features/admin/auth/AdminLoginPage.jsx';
import { AdminHomePage } from '@/features/admin/dashboard/AdminHomePage.jsx';
import { AdminEventsPage } from '@/features/admin/events/AdminEventsPage.jsx';
import { AdminHomeSettingsPage } from '@/features/admin/home/AdminHomeSettingsPage.jsx';
import { AdminLayout } from '@/features/admin/layout/AdminLayout.jsx';
import { AdminOrderListPage } from '@/features/admin/media/AdminOrderListPage.jsx';
import { AdminMenuPage } from '@/features/admin/menu/AdminMenuPage.jsx';
import { AdminOrdersPage } from '@/features/admin/orders/AdminOrdersPage.jsx';
import { AdminStaffSettingsPage } from '@/features/admin/staff/AdminStaffSettingsPage.jsx';

const managerRoles = ['developer', 'manager'];

function useAdminNavigation() {
  const router = useRouter();
  return useCallback((route) => router.push(route), [router]);
}

function AdminProtectedRoute({ children, roles }) {
  const pathname = usePathname();
  const navigate = useAdminNavigation();
  const { loading, user, error } = useAdminAuth();
  const isAllowed = !roles || roles.includes(user?.role);

  useEffect(() => {
    if (!loading && !user) navigate('/admin/login');
    else if (!loading && user && !isAllowed) navigate('/admin/staff');
  }, [isAllowed, loading, navigate, user]);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} />;
  if (!user || !isAllowed) return null;
  return <AdminLayout route={pathname} navigate={navigate}>{children}</AdminLayout>;
}

function AdminAnonymousRoute({ children, redirectAuthenticated = false }) {
  const navigate = useAdminNavigation();
  const { loading, user, error } = useAdminAuth();

  useEffect(() => {
    if (!loading && redirectAuthenticated && user) navigate('/admin');
  }, [loading, navigate, redirectAuthenticated, user]);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} />;
  if (redirectAuthenticated && user) return null;
  return children;
}

export function AdminDashboardRoute() {
  const navigate = useAdminNavigation();
  return <AdminProtectedRoute><AdminHomePage navigate={navigate} /></AdminProtectedRoute>;
}

export function AdminHomeSettingsRoute() {
  return <AdminProtectedRoute roles={managerRoles}><AdminHomeSettingsPage /></AdminProtectedRoute>;
}

export function AdminStaffSettingsRoute() {
  return <AdminProtectedRoute><AdminStaffSettingsPage /></AdminProtectedRoute>;
}

export function AdminEventsRoute() {
  return <AdminProtectedRoute roles={managerRoles}><AdminEventsPage /></AdminProtectedRoute>;
}

export function AdminMenuRoute() {
  return <AdminProtectedRoute roles={managerRoles}><AdminMenuPage /></AdminProtectedRoute>;
}

export function AdminOrdersRoute() {
  return <AdminProtectedRoute><AdminOrdersPage /></AdminProtectedRoute>;
}

export function AdminOrderListRoute() {
  return <AdminProtectedRoute><AdminOrderListPage /></AdminProtectedRoute>;
}

export function AdminLoginRoute() {
  const navigate = useAdminNavigation();
  return <AdminAnonymousRoute redirectAuthenticated><AdminLoginPage navigate={navigate} /></AdminAnonymousRoute>;
}

export function AdminForgotPasswordRoute() {
  const navigate = useAdminNavigation();
  return <AdminAnonymousRoute><AdminForgotPasswordPage navigate={navigate} /></AdminAnonymousRoute>;
}

function AdminLoading() {
  return <main className="adminState" role="status"><div className="adminStateMark">LD</div><p>正在確認後台通行資格…</p></main>;
}

function AdminError({ error }) {
  return <main className="adminState adminStateError" role="alert"><div className="adminStateMark">!</div><h1>後台暫時無法連線</h1><p>{error.message}</p></main>;
}
