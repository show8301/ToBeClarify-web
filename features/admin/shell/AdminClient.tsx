"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminRouter } from "@/features/admin/shell/AdminRouter.jsx";
import { AdminImageProcessingProvider } from "@/features/admin/media/AdminImageProcessingProvider.jsx";
import { AdminToastProvider } from "@/features/admin/shared/AdminToastProvider.jsx";

export default function AdminClient() {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = useCallback((route: string) => router.push(route), [router]);

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
          <AdminRouter route={pathname} navigate={navigate} />
        </AdminImageProcessingProvider>
      </AdminToastProvider>
    </div>
  );
}
