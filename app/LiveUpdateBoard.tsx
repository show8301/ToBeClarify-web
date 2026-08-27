"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LiveUpdateConfig, StaffReservation } from "./site-types";
import type { StaffSummary } from "./staff-types";

function tonightRange(){
  const from=new Date();
  from.setHours(18,0,0,0);
  const to=new Date(from);to.setDate(to.getDate()+2);to.setHours(3,0,0,0);
  return{from:from.toISOString(),to:to.toISOString()};
}
const minutes=(value:string)=>{const [hour,minute]=value.split(":").map(Number);return hour*60+minute};
const liveScrollKey="lucid-liveupdate-scroll";
const livePageTitle="即時動態｜清醒夢 Lucid Dream";

function LiveStaffCard({person,duplicate=false,onNavigate}:{person:StaffSummary;duplicate?:boolean;onNavigate:(event:React.MouseEvent<HTMLAnchorElement>)=>void}){
  return <a href={`/staff/${person.id}?from=liveupdate`} onClick={duplicate?undefined:onNavigate} tabIndex={duplicate?-1:undefined} aria-hidden={duplicate||undefined}>
    <img src={person.avatarUrl||"/og.png"} alt={duplicate?"":person.displayName} loading="eager" decoding="async" onError={event=>{if(!event.currentTarget.src.endsWith("/og.png"))event.currentTarget.src="/og.png"}}/>
    <span className={person.currentStatus||"available"} aria-label={person.statusText||"待命中"} title={person.statusText||"待命中"}><i/></span>
    <strong>{person.displayName}</strong>
    <small>{person.roleTitle||"DREAM STAFF"}</small>
  </a>;
}

function LiveMarqueeRow({people,reverse=false,onNavigate}:{people:StaffSummary[];reverse?:boolean;onNavigate:(event:React.MouseEvent<HTMLAnchorElement>)=>void}){
  const rowRef=useRef<HTMLDivElement>(null);
  const pausedUntil=useRef(0);
  const focused=useRef(false);
  useEffect(()=>{
    const row=rowRef.current;
    if(!row||people.length<2)return;
    const segment=row.querySelector<HTMLElement>("[data-marquee-segment]");
    if(!segment)return;
    let frame=0;
    let previous=performance.now();
    const initialFrame=requestAnimationFrame(()=>{row.scrollLeft=segment.offsetWidth});
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return()=>cancelAnimationFrame(initialFrame);
    const tick=(now:number)=>{
      const width=segment.offsetWidth;
      const elapsed=Math.min(64,now-previous);
      previous=now;
      if(width>0&&!focused.current&&Date.now()>=pausedUntil.current){
        row.scrollLeft+=(reverse?-1:1)*elapsed*.022;
        if(row.scrollLeft>=width*2)row.scrollLeft-=width;
        else if(row.scrollLeft<=0)row.scrollLeft+=width;
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(initialFrame);cancelAnimationFrame(frame)};
  },[people.length,reverse]);
  const pause=()=>{pausedUntil.current=Date.now()+2000};
  const resume=()=>{pausedUntil.current=0};
  return <div ref={rowRef} className={`live-marquee-row${reverse?" is-reverse":""}`} aria-label={reverse?"今晚待命店員第二排":"今晚待命店員第一排"} onPointerDown={pause} onPointerUp={resume} onPointerCancel={resume} onWheel={()=>{pausedUntil.current=Date.now()+350}} onPointerEnter={event=>{if(event.pointerType==="mouse")focused.current=true}} onPointerLeave={event=>{if(event.pointerType==="mouse"){focused.current=false;resume()}}} onFocus={event=>{const target=event.target as HTMLElement;focused.current=target.matches(":focus-visible");if(!focused.current)resume()}} onBlur={()=>{focused.current=false;resume()}}>
    <div className="live-marquee-track">
      <div className="live-marquee-group" aria-hidden="true">{people.map(person=><LiveStaffCard key={`before-${person.id}`} person={person} duplicate onNavigate={onNavigate}/>)}</div>
      <div className="live-marquee-group" data-marquee-segment>{people.map(person=><LiveStaffCard key={person.id} person={person} onNavigate={onNavigate}/>)}</div>
      <div className="live-marquee-group" aria-hidden="true">{people.map(person=><LiveStaffCard key={`after-${person.id}`} person={person} duplicate onNavigate={onNavigate}/>)}</div>
    </div>
  </div>;
}

export default function LiveUpdateBoard({staff,config}:{staff:StaffSummary[];config:LiveUpdateConfig}){
  const [staffMembers,setStaffMembers]=useState(staff);
  const [reservations,setReservations]=useState<StaffReservation[]>([]);
  const [updated,setUpdated]=useState<Date|null>(null);
  const [syncStatus,setSyncStatus]=useState<"syncing"|"ready"|"error">("syncing");
  const syncInFlight=useRef(false);
  const slots=config.timeSlots?.length?config.timeSlots:["20:00","21:00","22:00","23:00","24:00","25:00"];
  const start=minutes(config.scheduleStart||slots[0]);
  const end=minutes(config.scheduleEnd||slots[slots.length-1]);

  useLayoutEffect(()=>{
    document.title=livePageTitle;
    const savedPosition=sessionStorage.getItem(liveScrollKey);
    if(savedPosition===null)return;
    const root=document.documentElement;
    const previousBehavior=root.style.scrollBehavior;
    const targetPosition=Number(savedPosition);
    history.scrollRestoration="manual";
    root.style.scrollBehavior="auto";
    const restorePosition=()=>window.scrollTo(0,targetPosition);
    restorePosition();
    const firstFrame=requestAnimationFrame(()=>{restorePosition();requestAnimationFrame(restorePosition)});
    const settleTimer=window.setTimeout(()=>{
      restorePosition();
      sessionStorage.removeItem(liveScrollKey);
      root.style.scrollBehavior=previousBehavior;
    },120);
    return()=>{cancelAnimationFrame(firstFrame);clearTimeout(settleTimer)};
  },[]);

  const rememberLivePosition=useCallback((event:React.MouseEvent<HTMLAnchorElement>)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    sessionStorage.setItem(liveScrollKey,String(window.scrollY));
  },[]);

  const syncLiveStatus=useCallback(async()=>{
    if(syncInFlight.current)return;
    syncInFlight.current=true;
    setSyncStatus("syncing");
    try{
      const range=tonightRange();
      const response=await fetch(`/api/live-status?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,{cache:"no-store"});
      if(!response.ok)throw new Error(`Live status returned ${response.status}`);
      const payload=await response.json() as {staff:StaffSummary[];reservations:StaffReservation[];syncedAt:string};
      setStaffMembers(payload.staff);
      setReservations(payload.reservations);
      setUpdated(new Date(payload.syncedAt));
      setSyncStatus("ready");
    }catch{
      setSyncStatus("error");
    }finally{
      syncInFlight.current=false;
    }
  },[]);
  useEffect(()=>{
    const initialTimer=window.setTimeout(()=>void syncLiveStatus(),0);
    const interval=window.setInterval(()=>void syncLiveStatus(),60_000);
    const syncWhenVisible=()=>{if(document.visibilityState==="visible")void syncLiveStatus()};
    window.addEventListener("focus",syncWhenVisible);
    document.addEventListener("visibilitychange",syncWhenVisible);
    return()=>{
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus",syncWhenVisible);
      document.removeEventListener("visibilitychange",syncWhenVisible);
    };
  },[syncLiveStatus]);

  const working=useMemo(()=>staffMembers.filter(person=>person.isWorkingToday),[staffMembers]);
  const marqueeRows=useMemo(()=>{
    const midpoint=Math.ceil(working.length/2);
    return[working.slice(0,midpoint),working.slice(midpoint)];
  },[working]);
  const bars=useCallback((staffId:string)=>reservations.filter(item=>item.staffId===staffId).map(item=>{
    const begins=new Date(item.startsAt);const finishes=new Date(item.endsAt);
    let begin=begins.getHours()*60+begins.getMinutes();let finish=finishes.getHours()*60+finishes.getMinutes();
    if(begin<12*60)begin+=24*60;if(finish<12*60)finish+=24*60;
    return{...item,left:Math.max(0,(begin-start)/(end-start)*100),width:Math.max(3,(finish-begin)/(end-start)*100)};
  }),[end,reservations,start]);

  return <div className="live-page">
    <section className="live-hero"><div><span>REAL-TIME DREAM STATUS</span><h1>LIVE<br/><i>TONIGHT</i></h1></div><div className={`live-clock is-${syncStatus}`} aria-live="polite"><span>AUTO SYNC</span><b>{updated?updated.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}):"CONNECTING"}</b><small><i/>{syncStatus==="syncing"?"正在同步店員狀態與預約":syncStatus==="error"?"自動同步暫時中斷":"每 60 秒自動更新"}</small>{syncStatus==="error"&&<button onClick={()=>void syncLiveStatus()}>同步失敗 · 點此重試 ↻</button>}</div><p>查看今晚店員的待命狀態與預約時段。資料會自動同步，不需要手動更新；實際服務安排請以現場店員說明為準。</p></section>

    <section className="live-status"><header><div><span>STAFF STATUS</span><h2>今晚待命</h2></div><b>{String(working.length).padStart(2,"0")} ON DUTY</b></header>{working.length?<><small className="live-marquee-hint">← 左右滑動查看全部店員 →</small><div className="live-marquee" aria-label="今晚待命店員"><LiveMarqueeRow people={marqueeRows[0]} onNavigate={rememberLivePosition}/>{marqueeRows[1].length>0&&<LiveMarqueeRow people={marqueeRows[1]} reverse onNavigate={rememberLivePosition}/>}</div></>:<p className="live-staff-empty">今晚尚無店員公開待命狀態。</p>}</section>

    <section className="live-timeline"><header><div><span>RESERVATION TIMELINE</span><h2>今夜時序</h2></div><p>{reservations.length?`目前公開 ${reservations.length} 筆預約時段。`:"公開預約會在這裡顯示；店員的即時狀態請以上方卡片為準。"}</p></header>{reservations.length?<div className="timeline-scroll"><div className="timeline-board" style={{minWidth:`${Math.max(760,slots.length*100)}px`}}><div className="timeline-times"><span>STAFF</span>{slots.map(slot=><b key={slot}>{slot}</b>)}</div>{working.map(person=><div className="timeline-row" key={person.id}><div><img src={person.avatarUrl||"/og.png"} alt="" loading="lazy" decoding="async"/><span>{person.displayName}</span></div><div className="timeline-line">{bars(person.id).map(bar=><span key={bar.id} className={bar.status} style={{left:`${bar.left}%`,width:`${bar.width}%`}}><b>{bar.serviceLabel}</b><small>{new Date(bar.startsAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",hour12:false})}</small></span>)}</div></div>)}</div></div>:<div className="timeline-empty"><span>NO PUBLIC RESERVATIONS</span><strong>今晚尚無公開預約</strong><p>有公開時段後會自動出現在這裡，不需要重新整理頁面。</p></div>}</section>
  </div>;
}
