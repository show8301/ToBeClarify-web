import GuestbookWall from "@/features/guestbook/components/GuestbookWall";
import SiteChrome from "@/components/layout/SiteChrome";
import { getSiteHome } from "@/features/site/server/data";
import { notFound } from "next/navigation";

export default function GuestbookPage() {
  const home = getSiteHome();
  if (home.pageVisibility.guestbook === false) notFound();
  return (
    <SiteChrome
      navigation={home.navigation}
      shopInfo={home.shopInfo}
      pageVisibility={home.pageVisibility}
    >
      <GuestbookWall />
    </SiteChrome>
  );
}
