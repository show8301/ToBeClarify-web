"use client";

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
          <AdminAuthProvider>{children}</AdminAuthProvider>
        </AdminImageProcessingProvider>
      </AdminToastProvider>
    </div>
  );
}
