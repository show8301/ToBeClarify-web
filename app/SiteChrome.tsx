"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HomePageVisibility, NavigationItem, ShopInfo } from "./site-types";

const pathAliases:Record<string,string> = { "/home":"/", "/event":"/gallery" };
const resolvePath = (path:string) => pathAliases[path] ?? path;
const pageRouteKeys:Record<string,keyof HomePageVisibility> = {
  "/": "home",
  "/staff": "staff",
  "/gallery": "gallery",
  "/menu": "menu",
  "/guestbook": "guestbook",
  "/liveupdate": "liveUpdate",
  "/staffRanking": "staffRanking",
  "/monetaryRanking": "monetaryRanking",
};
const pageNumbers:Record<string,string> = {
  "/": "00",
  "/staff": "01",
  "/gallery": "02",
  "/menu": "03",
  "/guestbook": "04",
  "/liveupdate": "05",
  "/staffRanking": "06",
  "/monetaryRanking": "07",
};

export default function SiteChrome({navigation,shopInfo,pageVisibility,menuHidden=false,children}:{navigation:NavigationItem[];shopInfo:ShopInfo;pageVisibility?:HomePageVisibility;menuHidden?:boolean;children:React.ReactNode}) {
  const [open,setOpen] = useState(false);
  const [leaving,setLeaving] = useState<string|null>(null);
  const [showFloatingTop,setShowFloatingTop] = useState(false);
  const [livePageVisibility,setLivePageVisibility] = useState(pageVisibility);
  const navigationTimer = useRef<ReturnType<typeof window.setTimeout>|null>(null);
  const navigationWatchdog = useRef<ReturnType<typeof window.setTimeout>|null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  useEffect(()=>{
    setLivePageVisibility(pageVisibility);
    if(!pageVisibility)return;
    const controller=new AbortController();
    fetch("https://api.marchgroup.net/api/client/home",{cache:"no-store",headers:{Accept:"application/json"},signal:controller.signal})
      .then((response)=>response.ok?response.json():null)
      .then((payload:unknown)=>{
        const data=payload as {success?:boolean;data?:{pageVisibility?:Partial<HomePageVisibility>}}|null;
        if(data?.success&&data.data?.pageVisibility)setLivePageVisibility({...pageVisibility,...data.data.pageVisibility});
      })
      .catch(()=>{});
    return()=>controller.abort();
  },[pageVisibility]);
  const visibility=livePageVisibility ?? pageVisibility;
  const isPageVisible = useCallback((route:string) => {
    const key = pageRouteKeys[resolvePath(route)];
    return visibility ? (!key || visibility[key] !== false) : !(menuHidden && resolvePath(route) === "/menu");
  }, [menuHidden, visibility]);
  const items = useMemo(()=>navigation.flatMap((item)=>item.children?.length?item.children:item).filter((item)=>item.routePath!=="/home"&&isPageVisible(item.routePath)),[isPageVisible,navigation]);

  const clearNavigation = useCallback(() => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    if (navigationWatchdog.current) window.clearTimeout(navigationWatchdog.current);
    navigationTimer.current = null;
    navigationWatchdog.current = null;
    setOpen(false);
    setLeaving(null);
  }, []);

  useEffect(()=>{clearNavigation()},[clearNavigation,pathname]);
  useEffect(() => {
    const restore = () => clearNavigation();
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", restore);
      clearNavigation();
    };
  }, [clearNavigation]);
  useEffect(() => {
    const updateFloatingTop = () => setShowFloatingTop(window.scrollY > Math.min(260, window.innerHeight * .34));
    updateFloatingTop();
    window.addEventListener("scroll", updateFloatingTop, {passive:true});
    window.addEventListener("resize", updateFloatingTop);
    return () => {
      window.removeEventListener("scroll", updateFloatingTop);
      window.removeEventListener("resize", updateFloatingTop);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event:KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const navigate = (event:React.MouseEvent<HTMLAnchorElement>,path:string) => {
    const href=resolvePath(path);
    if(href===pathname)return;
    event.preventDefault();
    setOpen(false);
    if(reduceMotion)return router.push(href);
    setLeaving(href);
    navigationTimer.current = window.setTimeout(() => {
      try { router.push(href); }
      catch { window.location.assign(href); }
    },560);
    navigationWatchdog.current = window.setTimeout(() => {
      const target = new URL(href, window.location.href);
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const expected = `${target.pathname}${target.search}${target.hash}`;
      if (current !== expected) window.location.assign(href);
      clearNavigation();
    },3200);
  };

  return <div className="site-frame">
    <div className="site-parallax-bubbles site-bubbles-far" aria-hidden="true"><i/><i/><i/><i/></div>
    <div className="site-parallax-bubbles site-bubbles-near" aria-hidden="true"><i/><i/></div>
    <div className="site-parallax-mist" aria-hidden="true"/>
    <header className="site-header">
      <a className="site-brand" href="/" onClick={(event)=>navigate(event,"/")}><strong>{shopInfo.name||"清醒夢"}</strong><span>LUCID DREAM</span></a>
      <span className="site-header-note">WAKING DREAM · EORZEA SALON</span>
      <button className={`site-menu-toggle${open?" is-open":""}`} onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls="site-navigation"><span/><span/><b>{open?"CLOSE":"MENU"}</b></button>
    </header>
    <nav id="site-navigation" className={`site-navigation${open?" is-open":""}`} aria-label="主要導覽">
      {(!visibility || visibility.home !== false) && <a className={pathname==="/"?"active":""} href="/" onClick={(event)=>navigate(event,"/")}><i>00</i><span>首頁</span></a>}
      {items.map((item,index)=>{const href=resolvePath(item.routePath);return <a className={pathname===href?"active":""} href={href} onClick={(event)=>navigate(event,href)} key={item.id}><i>{pageNumbers[href] ?? String(index+1).padStart(2,"0")}</i><span>{item.label}</span></a>})}
    </nav>
    <button
      className={`site-floating-top${showFloatingTop?" is-visible":""}`}
      onClick={()=>window.scrollTo({top:0,behavior:reduceMotion?"auto":"smooth"})}
      aria-label="回到頁面頂端"
    ><span aria-hidden="true">↑</span><b>TOP</b></button>
    <main className="site-content">{children}</main>
    <footer className="site-footer">
      <div><span>LUCID DREAM · EORZEA</span><strong>{shopInfo.name||"清醒夢"}</strong><p>{shopInfo.footerText}</p></div>
      <div><b>OPEN</b><span>{shopInfo.openHours}</span><b>LOCATION</b><span>{shopInfo.server} · {shopInfo.address}</span></div>
      {(!visibility || visibility.staff !== false) && <a href="/staff" onClick={(event)=>navigate(event,"/staff")}>MEET THE DREAMERS <i>↗</i></a>}
    </footer>
    <AnimatePresence>{leaving&&<motion.div className="site-route-transition" initial={{clipPath:"inset(100% 0 0 0)",filter:"blur(5px)"}} animate={{clipPath:"inset(0% 0 0 0)",filter:"blur(0px)"}} exit={{opacity:0}} transition={{duration:.58,ease:[.76,0,.24,1]}} aria-hidden="true"><motion.span initial={{opacity:0,y:18,letterSpacing:".42em"}} animate={{opacity:1,y:0,letterSpacing:".23em"}} transition={{delay:.25,duration:.55,ease:[.22,1,.36,1]}}>ENTERING ANOTHER DREAM <i>✦</i></motion.span></motion.div>}</AnimatePresence>
  </div>;
}
