import type { Metadata } from "next";
import LiveUpdateBoard from "@/features/live-update/components/LiveUpdateBoard";
import SiteChrome from "@/components/layout/SiteChrome";
import { getSiteHome } from "@/features/site/server/data";
import { getStaffList } from "@/features/staff/server/data";
import { getRoomsDataForLivePage } from "@/features/rooms/server/data";

export const metadata:Metadata={
  title:"即時動態｜清醒夢 Lucid Dream",
  description:"查看清醒夢今晚店員的待命狀態與公開預約時段。",
};

export default async function LiveUpdatePage(){
  const home=getSiteHome();
  const rooms=await getRoomsDataForLivePage();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><LiveUpdateBoard staff={getStaffList()} rooms={rooms.rooms} config={home.liveUpdateConfig}/></SiteChrome>;
}
