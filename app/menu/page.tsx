import MenuCatalog from "../MenuCatalog";
import SiteChrome from "../SiteChrome";
import { getMenuData, getSiteHome } from "../site-data";
import { notFound } from "next/navigation";

export default function MenuPage(){
  const home=getSiteHome();
  if(!home.pageVisibility.menu)notFound();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><MenuCatalog menu={getMenuData()}/></SiteChrome>;
}
