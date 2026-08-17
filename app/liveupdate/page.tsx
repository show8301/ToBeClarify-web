import LiveUpdateBoard from "../LiveUpdateBoard";
import SiteChrome from "../SiteChrome";
import { getSiteHome } from "../site-data";
import { getStaffList } from "../staff-data";

export default function LiveUpdatePage(){
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo}><LiveUpdateBoard staff={getStaffList()} config={home.liveUpdateConfig}/></SiteChrome>;
}
