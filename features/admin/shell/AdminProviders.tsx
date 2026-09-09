"use client";

import {AdminNotificationProvider} from '@/features/admin/notifications/AdminNotificationCenter';
import {useAdminAuth} from '@/features/admin/auth/AdminAuthContext.jsx';
import { useEffect } from "react";
import { AdminAuthProvider } from "@/features/admin/auth/AdminAuthContext.jsx";
import { AdminImageProcessingProvider } from "@/features/admin/media/AdminImageProcessingProvider.jsx";
import { AdminToastProvider } from "@/features/admin/shared/AdminToastProvider.jsx";

export default function AdminProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    let savedTheme = "";
    try {
      savedTheme = window.localStorage.getItem("lucid-dream-admin-theme") || "";
    } catch {
      // Continue with the light theme when browser storage is unavailable.
    }
    document.documentElement.dataset.adminTheme = savedTheme === "dark" ? "dark" : "light";
  }, []);

  return (
    <div className="adminTheme">
      <AdminToastProvider>
        <AdminImageProcessingProvider>
          <AdminAuthProvider><AuthenticatedNotifications>{children}</AuthenticatedNotifications></AdminAuthProvider>
        </AdminImageProcessingProvider>
      </AdminToastProvider>
    </div>
  );
}

function AuthenticatedNotifications({children}:{children:React.ReactNode}){const {user}=useAdminAuth();return user?<AdminNotificationProvider key={user.id}>{children}</AdminNotificationProvider>:children;}
