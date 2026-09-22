import type { Metadata } from "next";
import SiteChrome from "@/components/layout/SiteChrome";
import CollectionPortal from "@/features/collection/components/CollectionPortal";
import { getSiteHome } from "@/features/site/server/data";

export const metadata: Metadata = {
  title: "作品領取｜清醒夢 Lucid Dream",
  description: "使用專屬領取碼查看繪圖、簽繪與委託作品的交付進度。",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function CollectionPage() {
  const home = getSiteHome();
  return (
    <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}>
      <CollectionPortal />
    </SiteChrome>
  );
}
