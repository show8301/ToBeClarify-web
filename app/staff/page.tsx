import StaffArchive from "../StaffArchive";
import SiteChrome from "../SiteChrome";
import { getSiteHome } from "../site-data";
import { getStaffList } from "../staff-data";

export default function StaffIndexPage(){
  const staff=getStaffList();
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} menuHidden={home.menuHidden}><StaffArchive initialStaff={staff} embedded/></SiteChrome>;
}
