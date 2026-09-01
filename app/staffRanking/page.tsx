import HallOfHonor from "@/features/rankings/components/HallOfHonor";
import SiteChrome from "@/components/layout/SiteChrome";
import { getRankings, getSiteHome } from "@/features/site/server/data";

export default function StaffRankingPage(){const home=getSiteHome();return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><HallOfHonor items={getRankings("staffRanking")} variant="staff"/></SiteChrome>}
