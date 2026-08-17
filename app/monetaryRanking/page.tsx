import HallOfHonor from "../HallOfHonor";
import SiteChrome from "../SiteChrome";
import { getRankings, getSiteHome } from "../site-data";

export default function MonetaryRankingPage(){const home=getSiteHome();return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo}><HallOfHonor items={getRankings("monetaryRanking")} variant="monetary"/></SiteChrome>}
