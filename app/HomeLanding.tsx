"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { HomeData } from "./site-types";

export default function HomeLanding({home}:{home:HomeData}){
  const [slide,setSlide]=useState(0);
  const reduceMotion=useReducedMotion();
  const images=home.slides.length?home.slides:home.shopInfo.heroImage?[{id:"hero",imageUrl:home.shopInfo.heroImage,displaySeconds:10}]:[];
  const current=images[slide%Math.max(images.length,1)];

  useEffect(()=>{
    if(reduceMotion||images.length<2)return;
    const seconds=Math.min(5,Math.max(3.5,current?.displaySeconds||5));
    const timer=window.setTimeout(()=>setSlide(value=>(value+1)%images.length),seconds*1000);
    return()=>window.clearTimeout(timer);
  },[current?.displaySeconds,images.length,reduceMotion,slide]);

  return <div className="home-page">
    {!reduceMotion&&<motion.div className="home-dream-entry" aria-hidden="true" initial={{opacity:1}} animate={{opacity:0,visibility:"hidden"}} transition={{opacity:{delay:1.15,duration:.85,ease:[.76,0,.24,1]},visibility:{delay:2}}}>
      <motion.span initial={{opacity:0,letterSpacing:".48em"}} animate={{opacity:1,letterSpacing:".28em"}} transition={{delay:.18,duration:.8}}>BETWEEN WAKING AND DREAM</motion.span>
      <motion.i initial={{scaleX:0,opacity:0}} animate={{scaleX:1,opacity:1}} transition={{delay:.1,duration:1.05,ease:[.22,1,.36,1]}}/>
      <b>清醒夢</b>
    </motion.div>}
    <section className="home-hero">
      <div className="home-hero-visual">
        <AnimatePresence mode="sync" initial={!reduceMotion}>{current&&<motion.img key={current.id} src={current.imageUrl} alt="清醒夢店內景象" initial={reduceMotion?false:{opacity:0,scale:1.075,filter:"blur(10px)"}} animate={{opacity:1,scale:1,filter:"blur(0px)"}} exit={reduceMotion?{opacity:0}:{opacity:0,scale:1.025,filter:"blur(6px)"}} transition={{duration:reduceMotion ? .2 : 1.65,ease:[.22,1,.36,1]}}/>}</AnimatePresence>
        <span className="home-dream-caustics" aria-hidden="true"/>
        <span className="home-dream-mist" aria-hidden="true"/>
        <span className="home-hero-grid"/>
        <span className="home-hero-index" aria-live="polite">{String(slide+1).padStart(2,"0")} / {String(images.length).padStart(2,"0")}</span>
        {images.length>1&&<div className="home-slide-controls" aria-label="店景輪播控制">
          <button className="home-slide-arrow" onClick={()=>setSlide(value=>(value-1+images.length)%images.length)} aria-label="上一張店景">←</button>
          <div className="home-slide-dots">{images.map((image,index)=><button key={image.id} onClick={()=>setSlide(index)} className={index===slide?"active":""} aria-label={`切換至第 ${index+1} 張店景`}/>)}</div>
          <button className="home-slide-arrow" onClick={()=>setSlide(value=>(value+1)%images.length)} aria-label="下一張店景">→</button>
        </div>}
      </div>
      <motion.div className="home-hero-copy" initial={reduceMotion?false:{opacity:0,y:28,filter:"blur(8px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} transition={{delay:reduceMotion ? 0 : .72,duration:reduceMotion ? .2 : 1.15,ease:[.22,1,.36,1]}}>
        <span>WELCOME TO THE WAKING DREAM</span>
        <h1><i>LUCID</i><br/>DREAM</h1>
        <p>{home.shopInfo.subtitle}</p>
        <div className="home-business-status"><b><i aria-hidden="true"/><span><small>LIVE STATUS</small>{home.shopInfo.businessStatus}</span></b><span>{home.shopInfo.openHours}</span></div>
        <a href="/staff">MEET THE DREAMERS <i>↗</i></a>
      </motion.div>
      <div className="home-hero-ticket"><span>SERVER</span><b>{home.shopInfo.server}</b><span>ADDRESS</span><b>{home.shopInfo.address}</b><em>LD · 2026</em></div>
    </section>

    <section className="home-marquee" aria-label="店舖特色"><span>ROLE PLAY SALON</span><i>✦</i><span>DEEP NIGHT STORIES</span><i>✦</i><span>PHOTO & COMPANY</span><i>✦</i><span>EORZEA WEEKEND</span></section>

    <section className="home-about">
      <div className="home-about-title"><span>ABOUT THE DREAM</span><h2>在清醒與夢境<br/>交界的深夜沙龍</h2></div>
      <div className="home-about-photo"><img src={home.shopInfo.heroImage||current?.imageUrl} alt="清醒夢空間"/><span>PLACE / 001</span></div>
      <div className="home-about-copy">{home.shopInfo.about.map((paragraph,index)=><p key={index}>{paragraph}</p>)}<div><b>OPEN</b><span>{home.shopInfo.openHours}</span><b>WHERE</b><span>{home.shopInfo.server} · {home.shopInfo.address}</span></div></div>
    </section>

    <section className="home-pricing">
      <header><div><span>FIRST VISIT GUIDE</span><h2>入夢指南</h2></div><p>{home.shopInfo.entryNote}</p></header>
      <div>{home.shopInfo.pricing.map((item,index)=><motion.article key={item.name} initial={reduceMotion?false:{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.25}} transition={{delay:index*.08}}><span>{String(index+1).padStart(2,"0")}</span><h3>{item.name}</h3><b>{item.price}</b><i>{index===0?"ENTRY":index===1?"COMPANY":"PRIVATE"}</i></motion.article>)}</div>
    </section>

    {!!home.carousels.length&&<section className="home-events">
      <header><div><span>EORZEA WEEKLY</span><h2>本期夢境</h2></div><a href="/gallery">VIEW ALL REPORTS ↗</a></header>
      <div className="home-event-track">{home.carousels.map((event,index)=><a href={`/gallery/${event.albumId}`} className="home-event-card" key={event.id}><img src={event.imageUrl} alt={event.title}/><span>{event.eventTime}</span><div><small>REPORT / {String(index+1).padStart(2,"0")}</small><h3>{event.title}</h3><p>{event.summary}</p><b>{event.ctaLabel} ↗</b></div></a>)}</div>
    </section>}

    <section className="home-rules">
      <header><span>HOUSE ETIQUETTE</span><h2>每一場夢<br/>都值得珍藏</h2><p>入場前請先理解彼此的界線。角色互動建立於尊重、同意與舒適節奏之上。</p></header>
      <ol>{home.shopRules.map((rule,index)=><li key={rule.id}><span>{String(index+1).padStart(2,"0")}</span><div><p>{rule.ruleText}</p>{rule.ruleNote&&<small>{rule.ruleNote}</small>}</div></li>)}</ol>
    </section>

    <section className="home-final-cta"><span>READY TO ENTER?</span><h2>今晚，想遇見<br/>哪一場夢？</h2><div><a href="/staff">店員一覽 <i>↗</i></a><a href="/menu">佳餚名錄 <i>↗</i></a></div></section>
  </div>;
}
