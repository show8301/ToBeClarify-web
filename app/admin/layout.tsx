import type { Metadata } from "next";
import "../../styles/admin/site.css";

export const metadata: Metadata = {
  title: "清醒夢｜後台管理",
  description: "清醒夢測試環境內容管理後台",
  robots: { index: false, follow: false },
};

export default function AdminRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
