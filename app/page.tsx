import HomeLanding from "@/features/home/components/HomeLanding";
import SiteChrome from "@/components/layout/SiteChrome";
import { getMenuData, getSiteHome } from "@/features/site/server/data";

export default function Home() {
  const home=getSiteHome();
  const menu=getMenuData();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><HomeLanding home={home} pricingRules={menu.pricingRules}/></SiteChrome>;
}
