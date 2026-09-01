import GuestbookWall from "@/features/guestbook/components/GuestbookWall";
import SiteChrome from "@/components/layout/SiteChrome";
import { getGuestbookComments, getSiteHome } from "@/features/site/server/data";

export default function GuestbookPage(){
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><GuestbookWall initial={getGuestbookComments()}/></SiteChrome>;
}
