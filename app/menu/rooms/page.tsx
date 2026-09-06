import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteChrome from "@/components/layout/SiteChrome";
import RoomCatalog from "@/features/rooms/components/RoomCatalog";
import { getRoomsData } from "@/features/rooms/server/data";
import { getSiteHome } from "@/features/site/server/data";

export const metadata:Metadata={
  title:"包廂介紹｜清醒夢 Lucid Dream",
  description:"查看清醒夢店內共用與店員專屬包廂的空間照片、每節價格與使用說明。",
};

export default function RoomPage(){
  const home=getSiteHome();
  if(!home.pageVisibility.menu||!home.pageVisibility.rooms)notFound();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><RoomCatalog data={getRoomsData()}/></SiteChrome>;
}
