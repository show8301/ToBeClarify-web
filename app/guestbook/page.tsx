import GuestbookWall from "../GuestbookWall";
import SiteChrome from "../SiteChrome";
import { getGuestbookComments, getSiteHome } from "../site-data";

export default function GuestbookPage(){
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><GuestbookWall initial={getGuestbookComments()}/></SiteChrome>;
}
