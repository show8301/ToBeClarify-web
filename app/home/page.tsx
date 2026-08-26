import HomeLanding from "../HomeLanding";
import SiteChrome from "../SiteChrome";
import { getSiteHome } from "../site-data";

export default function HomeAliasPage(){
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><HomeLanding home={home}/></SiteChrome>;
}
