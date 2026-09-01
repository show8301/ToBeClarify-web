import type { Metadata } from "next";
import OrderClient from "@/features/ordering/components/OrderClient";
import "../../styles/ordering/site.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "清醒夢｜顧客點餐",
  description: "當日多次點餐、指名服務與小費分配",
  robots: { index: false, follow: false },
};

export default function OrderPage() {
  return <OrderClient />;
}
