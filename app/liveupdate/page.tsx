import type { Metadata } from "next";
import LiveUpdateBoard from "../LiveUpdateBoard";
import SiteChrome from "../SiteChrome";
import { getSiteHome } from "@/features/site/server/data";
import { getStaffList } from "@/features/staff/server/data";

export const metadata:Metadata={
  title:"即時動態｜清醒夢 Lucid Dream",
  description:"查看清醒夢今晚店員的待命狀態與公開預約時段。",
};

export default function LiveUpdatePage(){
  const home=getSiteHome();
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}><LiveUpdateBoard staff={getStaffList()} config={home.liveUpdateConfig}/></SiteChrome>;
}
