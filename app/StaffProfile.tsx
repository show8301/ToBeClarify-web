"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StaffDetail, StaffSummary } from "./staff-types";

const fallbackPortrait = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'%3E%3Crect width='100%25' height='100%25' fill='%23d9d2c5'/%3E%3Ccircle cx='400' cy='390' r='150' fill='%23eee9df'/%3E%3Cpath d='M150 950c30-240 150-350 250-350s220 110 250 350' fill='%23eee9df'/%3E%3C/svg%3E";

type ProfileNavigation = { previous:StaffSummary|null; next:StaffSummary|null; total:number; list:StaffSummary[] };
type ClientCacheEntry = { data:StaffDetail; expiresAt:number };

const clientStaffCache = new Map<string,ClientCacheEntry>();
const clientStaffRequests = new Map<string,Promise<StaffDetail>>();
const CLIENT_CACHE_TTL = 10*60*1000;

function gil(value:number) {
  return `${value.toLocaleString("en-US")} Gil`;
}

function serviceDisplayPrice(service:StaffDetail["commonServices"][number]) {
  const override = service.priceText?.trim();
  if (override) return override;
  return service.price === null || service.price === undefined ? null : gil(service.price);
}

async function loadStaffDetail(id:string) {
  const cached=clientStaffCache.get(id);
  if(cached&&cached.expiresAt>Date.now())return cached.data;
  const pending=clientStaffRequests.get(id);
  if(pending)return pending;
  const request=(async()=>{
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),3000);
    try{
      const response=await fetch(`/api/staff/${id}`,{headers:{Accept:"application/json"},signal:controller.signal});
      if(!response.ok)throw new Error(`Staff request failed: ${response.status}`);
      const data=await response.json() as StaffDetail;
      clientStaffCache.set(id,{data,expiresAt:Date.now()+CLIENT_CACHE_TTL});
      return data;
    }finally{window.clearTimeout(timeout)}
  })();
  clientStaffRequests.set(id,request);
  try{return await request}finally{clientStaffRequests.delete(id)}
}

export default function StaffProfile({ staff, index, navigation }:{ staff:StaffDetail; index:number; navigation:ProfileNavigation }) {
  const [currentStaff, setCurrentStaff] = useState(staff);
  const [lightboxIndex, setLightboxIndex] = useState<number|null>(null);
  const [leaving, setLeaving] = useState(false);
  const [switching, setSwitching] = useState<"previous"|"next"|null>(null);
  const navigationLock = useRef(false);
  const navigationTimer = useRef<ReturnType<typeof window.setTimeout>|null>(null);
  const navigationWatchdog = useRef<ReturnType<typeof window.setTimeout>|null>(null);
  const swipeStart = useRef<{x:number;y:number;pointerId:number}|null>(null);
  const suppressPhotoClick = useRef(false);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const currentIndex=Math.max(navigation.list.findIndex(person=>person.id===currentStaff.id),index,0);
  const previous=navigation.total>1?navigation.list[(currentIndex-1+navigation.total)%navigation.total]:null;
  const next=navigation.total>1?navigation.list[(currentIndex+1)%navigation.total]:null;
  const services = [...(currentStaff.commonServices ?? []), ...(currentStaff.specialServices ?? [])];
  const images = currentStaff.gallery?.length ? currentStaff.gallery : currentStaff.avatarUrl ? [{id:"avatar",imageUrl:currentStaff.avatarUrl.replace("variant=card","variant=full")}] : [];
  const closeLightbox = useCallback(()=>setLightboxIndex(null),[]);
  const step = useCallback((amount:number)=>setLightboxIndex(current=>current===null||!images.length?null:(current+amount+images.length)%images.length),[images.length]);
  const replaceWithFallback = useCallback((href:string, hasArrived:()=>boolean) => {
    const navigate = () => {
      router.replace(href);
      navigationTimer.current = window.setTimeout(() => {
        if (!hasArrived()) window.location.replace(href);
      }, 1800);
    };
    if (reduceMotion) navigate();
    else window.requestAnimationFrame(navigate);
  }, [reduceMotion, router]);

  const clearNavigationState = useCallback(() => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    if (navigationWatchdog.current) window.clearTimeout(navigationWatchdog.current);
    navigationTimer.current = null;
    navigationWatchdog.current = null;
    navigationLock.current = false;
    setSwitching(null);
    setLeaving(false);
    document.documentElement.classList.remove("route-returning");
  }, []);

  const returnToRoster = useCallback(() => {
    if (navigationLock.current || leaving) return;
    navigationLock.current = true;
    const navigate = () => {
      history.scrollRestoration = "manual";
      document.documentElement.classList.add("route-returning");
      replaceWithFallback("/staff#roster",()=>window.location.pathname==="/staff"&&window.location.hash==="#roster");
    };
    if (reduceMotion) return navigate();
    setLeaving(true);
    navigate();
    navigationWatchdog.current = window.setTimeout(clearNavigationState, 3500);
  }, [clearNavigationState, leaving, reduceMotion, replaceWithFallback]);

  const switchStaff = useCallback(async (target:StaffSummary|null, direction:"previous"|"next") => {
    if (!target || navigationLock.current || switching || leaving) return;
    navigationLock.current = true;
    const href=`/staff/${target.id}`;
    if(!reduceMotion)setSwitching(direction);
    navigationTimer.current=window.setTimeout(()=>window.location.replace(href),3200);
    try{
      const data=await loadStaffDetail(target.id);
      if(navigationTimer.current)window.clearTimeout(navigationTimer.current);
      window.history.replaceState(window.history.state,"",href);
      document.title=`${data.displayName}｜清醒夢 Lucid Dream`;
      setLightboxIndex(null);
      setCurrentStaff(data);
    }catch{window.location.replace(href)}
  }, [leaving, reduceMotion, switching]);

  const startSwipe = useCallback((event:React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    swipeStart.current = { x:event.clientX, y:event.clientY, pointerId:event.pointerId };
    suppressPhotoClick.current = false;
  }, []);

  const finishSwipe = useCallback((event:React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const offsetX = event.clientX-start.x;
    const offsetY = event.clientY-start.y;
    if (Math.abs(offsetX)<64 || Math.abs(offsetX)<Math.abs(offsetY)*1.15) return;
    suppressPhotoClick.current = true;
    switchStaff(offsetX>0?previous:next,offsetX>0?"previous":"next");
  }, [next, previous, switchStaff]);

  useLayoutEffect(() => {
    clearNavigationState();
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { root.style.scrollBehavior = previousBehavior; });
  }, [clearNavigationState, currentStaff.id]);

  useEffect(() => {
    const restore = () => clearNavigationState();
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", restore);
      clearNavigationState();
    };
  }, [clearNavigationState]);

  useLayoutEffect(() => {
    if (window.location.pathname===`/staff/${staff.id}`&&currentStaff.id!==staff.id) setCurrentStaff(staff);
  }, [currentStaff.id, staff]);

  useEffect(() => {
    clientStaffCache.set(currentStaff.id,{data:currentStaff,expiresAt:Date.now()+CLIENT_CACHE_TTL});
    if(previous)void loadStaffDetail(previous.id).catch(()=>{});
    if(next)void loadStaffDetail(next.id).catch(()=>{});
  }, [currentStaff, next, previous]);

  useEffect(()=>{
    if(lightboxIndex===null)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")closeLightbox();if(event.key==="ArrowRight")step(1);if(event.key==="ArrowLeft")step(-1)};
    document.body.classList.add("modal-open");window.addEventListener("keydown",onKey);
    return()=>{document.body.classList.remove("modal-open");window.removeEventListener("keydown",onKey)};
  },[closeLightbox,lightboxIndex,step]);

  return <main className="profile-page">
    <div className="profile-dream-atmosphere" aria-hidden="true">
      <span className="profile-pearl pearl-one"/><span className="profile-pearl pearl-two"/><span className="profile-pearl pearl-three"/>
    </div>
    <motion.article key={currentStaff.id} className="profile-spread" initial={reduceMotion?{opacity:0}:{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.5,ease:[.22,1,.36,1]}}>
      <header className="profile-modal-head"><div><span>清醒夢 · PERSONNEL FILE</span><b>{currentStaff.displayName}</b></div><nav className="profile-switcher" aria-label="切換店員"><button onClick={()=>switchStaff(previous,"previous")} disabled={!previous} aria-label={`上一位${previous?`：${previous.displayName}`:""}`}><i>←</i><span>PREV</span><b>{previous?.displayName}</b></button><em>{String(currentIndex+1).padStart(2,"0")} / {String(navigation.total).padStart(2,"0")}</em><button onClick={()=>switchStaff(next,"next")} disabled={!next} aria-label={`下一位${next?`：${next.displayName}`:""}`}><span>NEXT</span><b>{next?.displayName}</b><i>→</i></button></nav><button className="back-to-staff" onClick={returnToRoster} aria-label="返回店員列表"><span className="back-label-wide">BACK TO STAFF</span><span className="back-label-short">LIST</span><i>←</i></button></header>
      <motion.div className="portrait-zone" onPointerDown={startSwipe} onPointerUp={finishSwipe} onPointerCancel={()=>{swipeStart.current=null}}>
        <motion.button className="main-polaroid" onClick={(event)=>{if(suppressPhotoClick.current){suppressPhotoClick.current=false;event.preventDefault();return}images.length&&setLightboxIndex(0)}} aria-label="放大查看店員照片" initial={reduceMotion?false:{opacity:0,y:-56,scale:1.025}} animate={{opacity:1,y:0,rotate:0,scale:1}} transition={{type:"spring",stiffness:125,damping:16,mass:.9,delay:.12}}><motion.span className="clip" initial={reduceMotion?false:{opacity:0,y:-25,rotate:-8}} animate={{opacity:1,y:0,rotate:0}} transition={{type:"spring",stiffness:240,damping:15,delay:.52}}>Ⅱ</motion.span><span className="main-photo"><img src={currentStaff.avatarUrl||fallbackPortrait} alt={`${currentStaff.displayName} 店員照片`}/></span><motion.span className="photo-caption" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:.48,duration:.28}}><b>{currentStaff.displayName}</b><i>PORTRAIT / 01</i></motion.span></motion.button>
        <motion.div className="status-stamp" initial={reduceMotion?false:{opacity:0,x:55,rotate:5}} animate={{opacity:1,x:0,rotate:-2}} transition={{type:"spring",stiffness:170,damping:17,delay:.58}}><i/><div><small>ON DUTY · TODAY</small><b>{currentStaff.statusText||"今日待命"}</b></div><em>LD</em></motion.div>
        <span className="portrait-swipe-hint">SWIPE TO SWITCH STAFF ↔</span>
      </motion.div>
      <motion.div className="dossier" initial={reduceMotion?false:{opacity:0,x:92,y:16,rotate:1.4,scale:.975}} animate={{opacity:1,x:0,y:0,rotate:0,scale:1}} transition={{type:"spring",stiffness:105,damping:18,mass:.9,delay:.2}}>
        <motion.div className="dossier-head" initial={reduceMotion?false:{opacity:0,clipPath:"inset(0 100% 0 0)"}} animate={{opacity:1,clipPath:"inset(0 0% 0 0)"}} transition={{duration:.52,ease:[.22,1,.36,1],delay:.42}}><div><span>DISPLAY NAME</span><h1>{currentStaff.displayName}</h1></div><motion.b className="file-number" initial={reduceMotion?false:{scale:0,rotate:-18}} animate={{scale:1,rotate:0}} transition={{type:"spring",stiffness:260,damping:16,delay:.72}}>{String(currentIndex+1).padStart(2,"0")}</motion.b></motion.div>
        <motion.div className="role-row" initial={reduceMotion?false:{scaleX:0}} animate={{scaleX:1}} style={{transformOrigin:"left center"}} transition={{duration:.42,ease:[.22,1,.36,1],delay:.58}}><motion.span initial={reduceMotion?false:{opacity:0,x:-14}} animate={{opacity:1,x:0}} transition={{delay:.78,duration:.25}}>{currentStaff.roleTitle||"DREAM STAFF"}</motion.span>{currentStaff.nickname&&<motion.i initial={reduceMotion?false:{opacity:0,x:14}} animate={{opacity:1,x:0}} transition={{delay:.84,duration:.25}}>AKA. {currentStaff.nickname}</motion.i>}</motion.div>
        <motion.div className="dossier-scroll" initial="hidden" animate="visible" variants={{hidden:{},visible:{transition:{delayChildren:.68,staggerChildren:.1}}}}>
          <motion.section className="gallery-block" variants={{hidden:reduceMotion?{opacity:1}:{opacity:0,y:20},visible:{opacity:1,y:0}}} transition={{duration:.36,ease:[.22,1,.36,1]}}><header><b>影像紀錄</b><button onClick={()=>images.length&&setLightboxIndex(0)} disabled={!images.length}>OPEN LIGHTBOX ↗</button></header><div className="filmstrip">{images.slice(0,6).map((image,i)=><button key={image.id} onClick={()=>setLightboxIndex(i)} aria-label={`查看第 ${i+1} 張照片`}><img src={image.imageUrl} alt=""/><span>{String(i+1).padStart(2,"0")}</span></button>)}</div></motion.section>
          <motion.section className="bio-block" variants={{hidden:reduceMotion?{opacity:1}:{opacity:0,y:20},visible:{opacity:1,y:0}}} transition={{duration:.36,ease:[.22,1,.36,1]}}><header><b>人物誌</b><span>PROFILE NOTE</span></header><p>{currentStaff.profileBio||currentStaff.shortBio||"這位夢境成員正在準備自己的介紹。"}</p></motion.section>
          {!!services.length&&<motion.section className="service-block" variants={{hidden:reduceMotion?{opacity:1}:{opacity:0,y:20},visible:{opacity:1,y:0}}} transition={{duration:.36,ease:[.22,1,.36,1]}}><header><b>服務項目</b><span>{services.length} SERVICES</span></header><div className="service-grid">{services.map((service,i)=>{
            const displayPrice=serviceDisplayPrice(service);
            const duration=service.durationMinutes === null || service.durationMinutes === undefined ? null : `${service.durationMinutes} 分鐘`;
            const additionalPrice=service.additionalPersonPrice === null || service.additionalPersonPrice === undefined ? null : `每位額外 +${gil(service.additionalPersonPrice)}`;
            return <article key={service.id}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{service.serviceName}</h3><p>{service.serviceDescription}</p></div>{displayPrice||duration||additionalPrice?<div className="service-price-meta">{displayPrice&&<b>{displayPrice}</b>}{duration&&<small>{duration}</small>}{additionalPrice&&<small>{additionalPrice}</small>}</div>:null}</article>;
          })}</div></motion.section>}
        </motion.div>
        <motion.div className="dossier-foot" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:1,duration:.28}}><span>RECORD ID · {currentStaff.id.slice(0,13)}</span><b>LUCID DREAM ✦</b></motion.div>
      </motion.div>
    </motion.article>

    <AnimatePresence>{leaving&&<motion.div className="route-transition route-transition-back" initial={{opacity:0,clipPath:"inset(0 0 100% 0)"}} animate={{opacity:1,clipPath:"inset(0 0 0% 0)"}} exit={{opacity:0}} transition={{duration:.26,ease:[.76,0,.24,1]}} aria-hidden="true"><motion.span initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} transition={{delay:.08,duration:.18}}>RETURNING TO STAFF <i>←</i></motion.span></motion.div>}</AnimatePresence>
    <AnimatePresence>{switching&&<motion.div className={`route-transition route-transition-staff ${switching}`} initial={{opacity:0,clipPath:switching==="next"?"inset(0 0 0 100%)":"inset(0 100% 0 0)"}} animate={{opacity:1,clipPath:"inset(0 0 0 0)"}} exit={{opacity:0}} transition={{duration:.26,ease:[.76,0,.24,1]}} aria-hidden="true"><motion.span initial={{opacity:0,x:switching==="next"?18:-18}} animate={{opacity:1,x:0}} transition={{delay:.08,duration:.18}}>{switching==="next"?"NEXT":"PREVIOUS"} PERSONNEL FILE <i>{switching==="next"?"→":"←"}</i></motion.span></motion.div>}</AnimatePresence>

    <AnimatePresence>{lightboxIndex!==null&&images[lightboxIndex]&&<motion.div className="lightbox" role="dialog" aria-modal="true" aria-label={`${currentStaff.displayName} 照片瀏覽器`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <div className="lightbox-top"><div><span>清醒夢 · PHOTO ARCHIVE</span><b>{currentStaff.displayName}</b></div><button onClick={closeLightbox}>CLOSE <i>×</i></button></div>
      <button className="lightbox-arrow prev" onClick={()=>step(-1)} aria-label="上一張">←</button>
      <motion.figure key={images[lightboxIndex].id} drag="x" dragConstraints={{left:0,right:0}} dragElastic={.7} onDragEnd={(_,info)=>Math.abs(info.offset.x)>70&&step(info.offset.x<0?1:-1)} initial={reduceMotion?{opacity:0}:{opacity:0,scale:.92}} animate={{opacity:1,scale:1}}><img src={images[lightboxIndex].imageUrl} alt={`${currentStaff.displayName} 的第 ${lightboxIndex+1} 張照片`}/><figcaption><span>LUCID DREAM / VISUAL RECORD</span><b>{String(lightboxIndex+1).padStart(2,"0")} — {String(images.length).padStart(2,"0")}</b></figcaption></motion.figure>
      <button className="lightbox-arrow next" onClick={()=>step(1)} aria-label="下一張">→</button><div className="lightbox-thumbs">{images.map((image,i)=><button key={image.id} className={i===lightboxIndex?"active":""} onClick={()=>setLightboxIndex(i)}><img src={image.imageUrl} alt=""/></button>)}</div>
    </motion.div>}</AnimatePresence>
  </main>;
}
