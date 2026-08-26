"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RankingItem } from "./site-types";

export default function HallOfHonor({items,variant}:{items:RankingItem[];variant:"staff"|"monetary"}){
  const reduceMotion=useReducedMotion();
  const staff=variant==="staff";
  const podium=[items[1],items[0],items[2]].filter(Boolean);
  return <div className="honor-page">
    <section className="honor-hero"><span>THE NAMES REMEMBERED BY THE DREAM</span><h1>HALL OF<br/><i>HONOR</i></h1><div><a href="/staffRanking" className={staff?"active":""}>店員榜 <i>STAFF</i></a><a href="/monetaryRanking" className={!staff?"active":""}>消費榜 <i>GUEST</i></a></div><p>{staff?"記錄最近一期最受旅人指名的夢境成員。每一次相遇，都是一份被記住的信任。":"向長期支持清醒夢的旅人致意。榜單僅顯示公開 ID 與當期累計紀錄。"}</p></section>

    {staff?<section className="staff-honor"><header><span>STAFF RANKING · {items[0]?.periodLabel||"CURRENT"}</span><h2>本期夢境之星</h2></header>{items.length?<div>{items.map((item,index)=><motion.a href={`/staff/${item.targetId}`} key={item.id} initial={reduceMotion?false:{opacity:0,y:30,rotate:-1}} animate={{opacity:1,y:0,rotate:index%2?1:-1}} transition={{duration:.55,delay:index*.08}}><span className="staff-honor-photo">{item.avatar?<img src={item.avatar.replace("variant=thumbnail","variant=full")} alt={item.displayName} loading="lazy" decoding="async"/>:<i>LD</i>}<b>RANK {String(item.rankPosition).padStart(2,"0")}</b></span><span className="staff-honor-copy"><small>{item.periodLabel} · NOMINATION</small><strong>{item.displayName}</strong><p>{item.titleBadge}</p><b>{item.scoreLabel}</b><i>VIEW PERSONNEL FILE ↗</i></span></motion.a>)}</div>:<p className="honor-empty">本期榜單仍在整理中。</p>}</section>:<>
      <section className="guest-podium"><header><span>GUEST RANKING · {items[0]?.periodLabel||"CURRENT"}</span><h2>夢境贊助者</h2></header>{items.length?<div>{podium.map((item,index)=><motion.article key={item.id} className={`rank-${item.rankPosition}`} initial={reduceMotion?false:{opacity:0,y:35}} animate={{opacity:1,y:0}} transition={{delay:index*.1}}><span>{String(item.rankPosition).padStart(2,"0")}</span><small>{item.titleBadge||"HONORED GUEST"}</small><strong>{item.displayName}</strong><b>{item.scoreLabel}</b><i>{item.rankPosition===1?"✦ CROWN OF THE DREAM ✦":"LUCID DREAM PATRON"}</i></motion.article>)}</div>:<p className="honor-empty">本期榜單仍在整理中。</p>}</section>
      {items.length>3&&<section className="guest-ranking-list"><header><span>FULL RECORD</span><b>{items.length} HONORED GUESTS</b></header><ol>{items.slice(3).map(item=><li key={item.id}><span>{String(item.rankPosition).padStart(2,"0")}</span><div><strong>{item.displayName}</strong><small>{item.titleBadge||"LUCID DREAM GUEST"}</small></div><b>{item.scoreLabel}</b><em>{item.periodLabel}</em></li>)}</ol></section>}
    </>}
  </div>;
}
