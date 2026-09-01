import StaffArchive from "@/features/staff/components/StaffArchive";
import SiteChrome from "@/components/layout/SiteChrome";
import { getSiteHome } from "@/features/site/server/data";
import { getStaffList } from "@/features/staff/server/data";

export default function StaffIndexPage(){
  const staff=getStaffList();
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><StaffArchive initialStaff={staff} embedded/></SiteChrome>;
}
