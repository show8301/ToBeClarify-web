import HallOfHonor from "@/features/rankings/components/HallOfHonor";
import SiteChrome from "@/components/layout/SiteChrome";
import { getRankings, getSiteHome } from "@/features/site/server/data";

export default function MonetaryRankingPage(){const home=getSiteHome();return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><HallOfHonor items={getRankings("monetaryRanking")} variant="monetary"/></SiteChrome>}
