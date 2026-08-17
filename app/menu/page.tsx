import MenuCatalog from "../MenuCatalog";
import SiteChrome from "../SiteChrome";
import { getMenuData, getSiteHome } from "../site-data";

export default function MenuPage(){
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo}><MenuCatalog menu={getMenuData()}/></SiteChrome>;
}
