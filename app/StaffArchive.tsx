"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StaffSummary } from "./staff-types";

const fallbackPortrait = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'%3E%3Crect width='100%25' height='100%25' fill='%23d9d2c5'/%3E%3Ccircle cx='400' cy='390' r='150' fill='%23eee9df'/%3E%3Cpath d='M150 950c30-240 150-350 250-350s220 110 250 350' fill='%23eee9df'/%3E%3C/svg%3E";
const rosterPageTitle = "清醒夢 Lucid Dream｜艾歐澤亞深夜沙龍";

export default function StaffArchive({ initialStaff, embedded=false }:{ initialStaff:StaffSummary[];embedded?:boolean }) {
  const [query, setQuery] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [featuredPaused, setFeaturedPaused] = useState(false);
  const navigationTimer = useRef<ReturnType<typeof window.setTimeout>|null>(null);
  const navigationWatchdog = useRef<ReturnType<typeof window.setTimeout>|null>(null);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const filtered = useMemo(() => initialStaff.filter((person) =>
    `${person.displayName}${person.nickname ?? ""}${person.roleTitle ?? ""}${person.shortBio ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [initialStaff, query]);
  const featuredPool = useMemo(() => initialStaff.filter((person) => Boolean(person.avatarUrl)), [initialStaff]);
  const featured = featuredPool[featuredIndex] ?? initialStaff[0];
  const featuredServices = featured ? [...(featured.commonServices ?? []), ...(featured.specialServices ?? [])] : [];

  useEffect(() => {
    if (featuredPool.length > 1) setFeaturedIndex(Math.floor(Math.random() * featuredPool.length));
  }, [featuredPool.length]);

  useEffect(() => {
    if (featuredPaused || featuredPool.length < 2) return;
    const rotation = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1 + Math.floor(Math.random() * (featuredPool.length - 1))) % featuredPool.length);
    }, 10000);
    return () => window.clearInterval(rotation);
  }, [featuredPaused, featuredPool.length]);

  useLayoutEffect(() => {
    document.title = rosterPageTitle;
    const savedPosition = sessionStorage.getItem("lucid-roster-scroll");
    const root = document.documentElement;
    if (!savedPosition) {
      root.classList.remove("route-returning");
      return;
    }
    const previousBehavior = root.style.scrollBehavior;
    history.scrollRestoration = "manual";
    root.style.scrollBehavior = "auto";
    const targetPosition = Number(savedPosition);
    const restorePosition = () => window.scrollTo(0, targetPosition);
    restorePosition();
    const firstFrame = requestAnimationFrame(() => {
      restorePosition();
      requestAnimationFrame(restorePosition);
    });
    const settleTimer = window.setTimeout(() => {
      restorePosition();
      sessionStorage.removeItem("lucid-roster-scroll");
      root.style.scrollBehavior = previousBehavior;
      root.classList.remove("route-returning");
    }, 120);
    return () => {
      cancelAnimationFrame(firstFrame);
      clearTimeout(settleTimer);
    };
  }, []);

  const clearNavigation = useCallback(() => {
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    if (navigationWatchdog.current) window.clearTimeout(navigationWatchdog.current);
    navigationTimer.current = null;
    navigationWatchdog.current = null;
    setLeaving(false);
  }, []);

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

  const openProfile = (event:React.MouseEvent<HTMLAnchorElement>, href:string) => {
    event.preventDefault();
    if (leaving) return;
    sessionStorage.setItem("lucid-roster-scroll", String(window.scrollY));
    if (reduceMotion) return router.push(href);
    setLeaving(true);
    navigationTimer.current = window.setTimeout(() => {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      try { router.push(href); }
      catch { window.location.assign(href); }
      requestAnimationFrame(() => { root.style.scrollBehavior = previousBehavior; });
    }, 280);
    navigationWatchdog.current = window.setTimeout(() => {
      const target = new URL(href, window.location.href);
      if (window.location.pathname !== target.pathname) window.location.assign(href);
      clearNavigation();
    }, 2800);
  };

  return (
    <div className={`archive-shell${embedded?" archive-embedded":""}`}>
      {!embedded&&<header className="archive-header">
        <a className="archive-brand" href="#roster">清醒夢 <i>LUCID DREAM</i></a>
        <span className="archive-edition">WAKING DREAM · STAFF ARCHIVE</span>
        <div className="header-count"><b>{String(initialStaff.length).padStart(2,"0")}</b><span>MEMBERS<br/>ON FILE</span></div>
      </header>}

      <section className="roster-intro" id="roster">
        <div><span className="section-kicker">THE PEOPLE BEHIND THE DREAM</span><h1>MEET THE<br/><i>DREAMERS</i></h1></div>
        {featured&&<motion.a key={featured.id} className={`intro-feature${featuredPaused?" is-paused":""}`} href={`/staff/${featured.id}`} onClick={(event)=>openProfile(event,`/staff/${featured.id}`)} onMouseEnter={()=>setFeaturedPaused(true)} onMouseLeave={()=>setFeaturedPaused(false)} onFocus={()=>setFeaturedPaused(true)} onBlur={()=>setFeaturedPaused(false)} initial={{opacity:0,y:14,rotate:1}} animate={{opacity:1,y:0,rotate:-1}} transition={{duration:.45,ease:[.22,1,.36,1]}} aria-label={`本次夢境推薦：${featured.displayName}`}>
          <span className="intro-feature-photo"><img src={featured.avatarUrl||fallbackPortrait} alt={`${featured.displayName} 的推薦照片`}/><i>{featured.isWorkingToday?"ON DUTY":"DREAM STAFF"}</i></span>
          <span className="intro-feature-copy"><small>RANDOM DREAMER · 本次推薦</small><strong>{featured.displayName}</strong><em>{featured.roleTitle||"DREAM STAFF"}</em>{featuredServices[0]&&<b>{featuredServices[0].serviceName}</b>}<span>VIEW FILE <ArrowUpRight aria-hidden="true"/></span></span>
          <i className="intro-feature-progress" aria-hidden="true"/>
        </motion.a>}
        <span className="intro-index">LUCID DREAM / 2026</span>
      </section>

      <section className="gallery-controls" aria-label="名單搜尋">
        <div><span>ALL STAFF</span><b>{String(filtered.length).padStart(2,"0")}</b></div>
        <label><span className="sr-only">搜尋店員</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋名字、職稱或特色…"/><b>SEARCH <ArrowUpRight aria-hidden="true"/></b></label>
      </section>

      <section className="staff-gallery" aria-label="店員視覺名單">
        {filtered.map((person, index) => {
            const services = [...(person.commonServices ?? []), ...(person.specialServices ?? [])];
            const canBeNominated = person.isNominatable === true;
            const fileNumber = String(index + 1).padStart(2,"0");
            return (
              <a href={`/staff/${person.id}`} onClick={(event) => openProfile(event, `/staff/${person.id}`)} key={person.id} className="dreamer-card" aria-label={`查看 ${person.displayName} 的完整介紹`}>
                <span className="dreamer-card-photo">
                  <img src={person.avatarUrl || fallbackPortrait} alt={`${person.displayName} 的店員照片`} loading={index < 2 ? "eager" : "lazy"} decoding="async"/>
                  <span className="dreamer-role-ribbon" title={person.roleTitle || "DREAM STAFF"}>
                    <i>✦</i><b>{person.roleTitle || "DREAM STAFF"}</b><i>✦</i>
                  </span>
                  <span className="dreamer-file-number">{fileNumber}</span>
                  <span className="dreamer-photo-statuses">
                    <span className={`dreamer-duty${person.isWorkingToday ? " is-online" : ""}`}>
                      <i aria-hidden="true"/><span><small>{person.isWorkingToday ? "ON DUTY" : "OFF DUTY"}</small><b>{person.statusText || "未排班"}</b></span>
                    </span>
                    {canBeNominated && <span className="dreamer-nomination" aria-label="此店員可以指名"><i aria-hidden="true">✦</i><b>可以指名</b></span>}
                  </span>
                </span>
                <span className="dreamer-card-body">
                  <span className={`dreamer-card-heading${person.signatureUrl ? " has-signature" : ""}`}>
                    {person.signatureUrl
                      ? <img className="dreamer-card-signature" src={person.signatureUrl} alt={`${person.displayName} 的簽名`}/>
                      : <strong>{person.displayName}</strong>}
                    {person.nickname && <em>✦ 暱稱｜{person.nickname} ✦</em>}
                  </span>
                  <span className="dreamer-card-bio">{person.shortBio || "這位夢境成員正在準備自己的介紹。"}</span>
                  <span className="dreamer-card-footer">
                    {services.length > 0 && <span className="dreamer-services" aria-label="可提供服務">
                      {services.slice(0,2).map((service,serviceIndex)=><b key={service.id}><img src={`/assets/staff-card-chip-icon-${serviceIndex===0?"a":"b"}.png`} alt="" aria-hidden="true"/>{service.serviceName}</b>)}
                      {services.length > 2 && <i><img src="/assets/staff-card-chip-icon-c.png" alt="" aria-hidden="true"/>+{services.length-2}</i>}
                    </span>}
                    <span className="dreamer-card-link"><small>FILE · {fileNumber}</small><b>VIEW PROFILE <ArrowUpRight aria-hidden="true"/></b></span>
                  </span>
                </span>
              </a>
            );
        })}
        {!filtered.length && <div className="empty-state"><b>NO MATCHES</b><p>換一個關鍵字，再找找看。</p></div>}
      </section>

      <AnimatePresence>{leaving&&<motion.div className="route-transition" initial={{opacity:0,clipPath:"inset(100% 0 0 0)"}} animate={{opacity:1,clipPath:"inset(0% 0 0 0)"}} exit={{opacity:0}} transition={{duration:.28,ease:[.76,0,.24,1]}} aria-hidden="true"><motion.span initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.1,duration:.18}}>OPENING PERSONNEL FILE <i>✦</i></motion.span></motion.div>}</AnimatePresence>

      <footer className="archive-footer"><span>清醒夢 · LUCID DREAM STAFF ARCHIVE</span><b>KEEP DREAMING ✦</b></footer>
    </div>
  );
}
