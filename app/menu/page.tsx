import MenuCatalog from "@/features/menu/components/MenuCatalog";
import SiteChrome from "@/components/layout/SiteChrome";
import { getMenuData, getSiteHome } from "@/features/site/server/data";
import { notFound } from "next/navigation";

export default function MenuPage(){
  const home=getSiteHome();
  if(!home.pageVisibility.menu)notFound();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><MenuCatalog menu={getMenuData()}/></SiteChrome>;
}
