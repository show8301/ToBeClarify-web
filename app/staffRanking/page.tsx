import HallOfHonor from "../HallOfHonor";
import SiteChrome from "../SiteChrome";
import { getRankings, getSiteHome } from "../site-data";

export default function StaffRankingPage(){const home=getSiteHome();return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><HallOfHonor items={getRankings("staffRanking")} variant="staff"/></SiteChrome>}
