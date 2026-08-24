"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminRouter } from "./_components/AdminRouter.jsx";

export default function AdminClient() {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = useCallback((route: string) => router.push(route), [router]);

  return (
    <div className="adminTheme">
      <AdminRouter route={pathname} navigate={navigate} />
    </div>
  );
}
