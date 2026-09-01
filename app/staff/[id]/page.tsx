import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StaffProfile from "../../StaffProfile";
import { getStaffDetail, getStaffList } from "@/features/staff/server/data";

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params;
  const staff=await getStaffDetail(id);
  if(!staff)return{title:"找不到店員｜清醒夢 Lucid Dream"};
  const title=`${staff.displayName}｜清醒夢 Lucid Dream`;
  const description=staff.shortBio||`認識清醒夢店員 ${staff.displayName}`;
  const image=staff.avatarUrl?[staff.avatarUrl]:[];
  return{title,description,openGraph:{title,description,images:image},twitter:{title,description,images:image}};
}

export default async function StaffPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{from?:string|string[]}>}){
  const {id}=await params;
  const query=await searchParams;
  const source=query.from==="liveupdate"?"liveupdate":null;
  const staff=await getStaffDetail(id);
  if(!staff)notFound();
  const list=getStaffList();
  const index=list.findIndex(person=>person.id===staff.id);
  const safeIndex=Math.max(index,0);
  const total=list.length;
  const previous=total>1?list[(safeIndex-1+total)%total]:null;
  const next=total>1?list[(safeIndex+1)%total]:null;
  return <StaffProfile staff={staff} index={safeIndex} navigation={{previous,next,total,list}} source={source}/>;
}
