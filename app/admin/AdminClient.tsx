"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminRouter } from "./_components/AdminRouter.jsx";
import { AdminImageProcessingProvider } from "./_components/AdminImageProcessingProvider.jsx";
import { AdminToastProvider } from "./_components/AdminToastProvider.jsx";

export default function AdminClient() {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = useCallback((route: string) => router.push(route), [router]);

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
