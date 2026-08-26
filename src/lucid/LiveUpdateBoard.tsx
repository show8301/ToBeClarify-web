"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveUpdateConfig, StaffReservation } from "./site-types";
import type { StaffSummary } from "./staff-types";
import { clientApiPath, clientApiRequest } from "./client-api";

const TAIPEI_OFFSET_MS=8*60*60*1000;

function tonightRange(now=new Date()){
  const taipeiDate=new Date(now.getTime()+TAIPEI_OFFSET_MS);
  if(taipeiDate.getUTCHours()<3)taipeiDate.setUTCDate(taipeiDate.getUTCDate()-1);
  const from=new Date(Date.UTC(taipeiDate.getUTCFullYear(),taipeiDate.getUTCMonth(),taipeiDate.getUTCDate(),10));
  const to=new Date(from.getTime()+9*60*60*1000);
  return{from:from.toISOString(),to:to.toISOString()};
}
const minutes=(value:string)=>{const [hour,minute]=value.split(":").map(Number);return hour*60+minute};
const taipeiMinutes=(value:string)=>{const shifted=new Date(new Date(value).getTime()+TAIPEI_OFFSET_MS);return shifted.getUTCHours()*60+shifted.getUTCMinutes()};

export default function LiveUpdateBoard({staff,config}:{staff:StaffSummary[];config:LiveUpdateConfig}){
  const [reservations,setReservations]=useState<StaffReservation[]>([]);
  const [updated,setUpdated]=useState<Date|null>(null);
  const [loading,setLoading]=useState(true);
  const [syncError,setSyncError]=useState("");
  const reduceMotion=useReducedMotion();
  const slots=config.timeSlots?.length?config.timeSlots:["20:00","21:00","22:00","23:00","24:00","25:00"];
  const start=minutes(config.scheduleStart||slots[0]);
  const end=minutes(config.scheduleEnd||slots[slots.length-1]);

  const load=useCallback(async()=>{
    setLoading(true);
    try{const range=tonightRange();const data=await clientApiRequest<StaffReservation[]>(clientApiPath("/staff-reservations",range));setReservations(data??[]);setUpdated(new Date());setSyncError("")}
    catch{setSyncError("即時預約同步失敗，畫面保留上次成功取得的資料。")}
    finally{setLoading(false)}
  },[]);
  useEffect(()=>{void load();const timer=window.setInterval(load,60_000);return()=>window.clearInterval(timer)},[load]);

  const working=useMemo(()=>staff.filter(person=>person.isWorkingToday),[staff]);
  const bars=useCallback((staffId:string)=>reservations.filter(item=>item.staffId===staffId).map(item=>{
    let begin=taipeiMinutes(item.startsAt);let finish=taipeiMinutes(item.endsAt);
    if(begin<12*60)begin+=24*60;if(finish<12*60)finish+=24*60;
    return{...item,left:Math.max(0,(begin-start)/(end-start)*100),width:Math.max(3,(finish-begin)/(end-start)*100)};
  }),[end,reservations,start]);

  return <div className="live-page">
    <section className="live-hero"><div><span>REAL-TIME DREAM STATUS</span><h1>LIVE<br/><i>TONIGHT</i></h1></div><div className="live-clock"><span>LAST SYNC</span><b>{updated?updated.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}):"--:--:--"}</b><button onClick={load} disabled={loading}>{loading?"SYNCING…":"REFRESH ↻"}</button></div><p>查看今晚店員的待命狀態與預約時段。頁面僅供瀏覽，實際服務安排請以現場店員說明為準。</p></section>

      <section className="live-status"><header><div><span>STAFF STATUS</span><h2>今晚待命</h2></div><b>{String(working.length).padStart(2,"0")} ON DUTY</b></header><div>{working.map((person,index)=><motion.a href={`/staff/${person.id}`} key={person.id} initial={reduceMotion?false:{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index*.035,.3)}}><img src={person.avatarUrl||"/og.png"} alt={person.displayName} loading="lazy" decoding="async"/><span className={person.currentStatus||"available"}><i/>{person.statusText||"待命中"}</span><strong>{person.displayName}</strong><small>{person.roleTitle||"DREAM STAFF"}</small></motion.a>)}</div></section>

      <section className="live-timeline"><header><div><span>RESERVATION TIMELINE</span><h2>今夜時序</h2></div><p role={syncError?"status":undefined}>{syncError||(reservations.length?`目前公開 ${reservations.length} 筆預約時段。`:"目前沒有公開預約，店員狀態仍會持續更新。")}</p></header><div className="timeline-scroll"><div className="timeline-board" style={{minWidth:`${Math.max(760,slots.length*100)}px`}}><div className="timeline-times"><span>STAFF</span>{slots.map(slot=><b key={slot}>{slot}</b>)}</div>{working.map(person=><div className="timeline-row" key={person.id}><div><img src={person.avatarUrl||"/og.png"} alt="" loading="lazy" decoding="async"/><span>{person.displayName}</span></div><div className="timeline-line">{bars(person.id).map(bar=><span key={bar.id} className={bar.status} style={{left:`${bar.left}%`,width:`${bar.width}%`}}><b>{bar.serviceLabel}</b><small>{new Date(bar.startsAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Taipei"})}</small></span>)}</div></div>)}</div></div></section>
  </div>;
}
