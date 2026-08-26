import HomeLanding from "./HomeLanding";
import SiteChrome from "./SiteChrome";
import { getSiteHome } from "./site-data";

export default function Home() {
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} menuHidden={home.menuHidden}><HomeLanding home={home}/></SiteChrome>;
}
