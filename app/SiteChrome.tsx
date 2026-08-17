"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { NavigationItem, ShopInfo } from "./site-types";

const pathAliases:Record<string,string> = { "/home":"/", "/event":"/gallery" };
const resolvePath = (path:string) => pathAliases[path] ?? path;

export default function SiteChrome({navigation,shopInfo,children}:{navigation:NavigationItem[];shopInfo:ShopInfo;children:React.ReactNode}) {
  const [open,setOpen] = useState(false);
  const [leaving,setLeaving] = useState<string|null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const items = useMemo(()=>navigation.flatMap((item)=>item.children?.length?item.children:item).filter((item)=>item.routePath!=="/home"),[navigation]);

  useEffect(()=>{setOpen(false);setLeaving(null)},[pathname]);

  const navigate = (event:React.MouseEvent<HTMLAnchorElement>,path:string) => {
    const href=resolvePath(path);
    if(href===pathname)return;
    event.preventDefault();
    setOpen(false);
    if(reduceMotion)return router.push(href);
    setLeaving(href);
    window.setTimeout(()=>router.push(href),560);
  };

  return <div className="site-frame">
    <header className="site-header">
      <a className="site-brand" href="/" onClick={(event)=>navigate(event,"/")}><strong>{shopInfo.name||"清醒夢"}</strong><span>LUCID DREAM</span></a>
      <span className="site-header-note">WAKING DREAM · EORZEA SALON</span>
      <button className={`site-menu-toggle${open?" is-open":""}`} onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls="site-navigation"><span/><span/><b>{open?"CLOSE":"MENU"}</b></button>
      <nav id="site-navigation" className={open?"is-open":""} aria-label="主要導覽">
        <a className={pathname==="/"?"active":""} href="/" onClick={(event)=>navigate(event,"/")}><i>00</i><span>首頁</span></a>
        {items.map((item,index)=>{const href=resolvePath(item.routePath);return <a className={pathname===href?"active":""} href={href} onClick={(event)=>navigate(event,href)} key={item.id}><i>{String(index+1).padStart(2,"0")}</i><span>{item.label}</span></a>})}
      </nav>
    </header>
    <main className="site-content">{children}</main>
    <footer className="site-footer">
      <div><span>LUCID DREAM · EORZEA</span><strong>{shopInfo.name||"清醒夢"}</strong><p>{shopInfo.footerText}</p></div>
      <div><b>OPEN</b><span>{shopInfo.openHours}</span><b>LOCATION</b><span>{shopInfo.server} · {shopInfo.address}</span></div>
      <a href="/staff" onClick={(event)=>navigate(event,"/staff")}>MEET THE DREAMERS <i>↗</i></a>
    </footer>
    <AnimatePresence>{leaving&&<motion.div className="site-route-transition" initial={{clipPath:"inset(100% 0 0 0)",filter:"blur(5px)"}} animate={{clipPath:"inset(0% 0 0 0)",filter:"blur(0px)"}} exit={{opacity:0}} transition={{duration:.58,ease:[.76,0,.24,1]}} aria-hidden="true"><motion.span initial={{opacity:0,y:18,letterSpacing:".42em"}} animate={{opacity:1,y:0,letterSpacing:".23em"}} transition={{delay:.25,duration:.55,ease:[.22,1,.36,1]}}>ENTERING ANOTHER DREAM <i>✦</i></motion.span></motion.div>}</AnimatePresence>
  </div>;
}
