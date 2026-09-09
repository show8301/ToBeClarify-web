"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { HomePageVisibility, MenuData } from "@/features/site/types";

const gil=(value:number)=>`${new Intl.NumberFormat("zh-TW").format(value)} Gil`;
const isInternalCopy=(value:string)=>/(demo|mock|測試|api\s*(提供|維護)|後台.*維護)/i.test(value);

export default function MenuCatalog({menu:initialMenu,roomsVisible=true}:{menu:MenuData;roomsVisible?:boolean}){
  const [menu,setMenu]=useState(initialMenu);
  const [menuStatus,setMenuStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,retry]=useState(0);
  useEffect(()=>{const controller=new AbortController();
    fetch('/api/public/menu',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error();const payload=await response.json() as {success:boolean;data:MenuData};
      if(!payload.success)throw new Error();if(!controller.signal.aborted){setMenu(payload.data);setMenuStatus('ready');}
    }).catch(()=>{if(!controller.signal.aborted)setMenuStatus('error');});
    return()=>controller.abort();
  },[attempt]);
  const [category,setCategory]=useState(menu.categories[0]?.id??"");
  const [roomVisibility,setRoomVisibility]=useState<{source:boolean;visible:boolean}|null>(null);
  const showRoomEntry=roomVisibility?.source===roomsVisible?roomVisibility.visible:roomsVisible;
  const reduceMotion=useReducedMotion();
  const active=menu.categories.find(item=>item.id===category)??menu.categories[0];
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/public/home",{cache:"no-store",headers:{Accept:"application/json"},signal:controller.signal})
      .then((response)=>response.ok?response.json():null)
      .then((payload:unknown)=>{
        const data=payload as {success?:boolean;data?:{pageVisibility?:Partial<HomePageVisibility>}}|null;
        if(data?.success&&data.data?.pageVisibility&&typeof data.data.pageVisibility.rooms==="boolean")setRoomVisibility({source:roomsVisible,visible:data.data.pageVisibility.rooms});
      })
      .catch(()=>{});
    return()=>controller.abort();
  },[roomsVisible]);
  return <div className="menu-page">
    {menuStatus!=='ready'&&<p className="menu-update-state" role="status">{menuStatus==='loading'?'正在更新菜單，以下內容供參考。':'菜單更新失敗，以下價格可能已變更，請洽店員確認。'}{menuStatus==='error'&&<button onClick={()=>{setMenuStatus('loading');retry(x=>x+1);}}>重新載入</button>}</p>}
    {menuStatus==='ready'&&menu.updatedAt&&<p className="menu-update-state">資料取得時間：{new Date(menu.updatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</p>}
    <section className="menu-hero">
      <div><span>THE TASTE OF A WAKING DREAM</span><h1>NIGHT<br/><i>MENU</i></h1></div>
      <div className="menu-cover-card"><span>清醒夢 · LUCID DREAM</span><b>佳餚名錄</b><p>在每一場夜談之間，留一點溫度給餐桌。飲品、甜點與套餐，為今晚的相遇添上一筆餘韻。</p><i>EDITION / 2026</i></div>
    </section>

    <section className="menu-pricing-rules">
      {menu.pricingRules.filter(rule=>rule.policy?.showOnMenu!==false).map((rule,index)=><article key={rule.id}><span>{String(index+1).padStart(2,"0")}</span><div><small>HOUSE CHARGE</small><h2>{rule.title}</h2>{rule.description&&!isInternalCopy(rule.description)&&<p>{rule.description}</p>}</div><b>{rule.priceText}</b></article>)}
    </section>

    {menu.showSets!==false&&menu.sets.some(set=>set.items.some(item=>item.isAvailable!==false))&&<section className="menu-sets">
      <header><div><span>CURATED SETS</span><h2>今夜套餐</h2></div><p>主餐、甜點與飲品已為不同的相遇節奏搭配成席。</p></header>
      <div>{menu.sets.filter(set=>set.items.some(item=>item.isAvailable!==false)).map((set,index)=><motion.article key={set.id} initial={reduceMotion?false:{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.15}} transition={{delay:index*.07}}>
        <span className="menu-set-photo">{set.imageUrl?<img src={set.imageUrl} alt={set.setName} loading="lazy" decoding="async"/>:<i>LD</i>}<small>SET / {String(index+1).padStart(2,"0")}</small></span>
        <div><h3>{set.setName}</h3><p>{set.setDescription}</p><ul>{set.items.filter(item=>item.isAvailable!==false).map(item=><li key={item.id}><span>{({main:"主餐",dessert:"甜點",drink:"飲品",other:"其他"}[item.itemRole]||"其他")}</span><b>{item.itemName} × {item.quantity}{item.isAvailable===false?" · 暫停供應":""}</b></li>)}</ul><strong>{gil(set.setPrice)}</strong>{set.isOrderable===false&&<p>{set.unavailableReason||"暫停供應"}</p>}</div>
      </motion.article>)}</div>
    </section>}

    <section className="menu-catalog">
      <header><div><span>À LA CARTE</span><h2>單點選集</h2></div><nav aria-label="菜單分類">{menu.categories.map(item=><button key={item.id} className={item.id===active?.id?"active":""} onClick={()=>setCategory(item.id)}>{item.categoryName}<i>{String(item.items.length).padStart(2,"0")}</i></button>)}</nav></header>
      <AnimatePresence mode="wait">{active&&<motion.div key={active.id} className="menu-category" initial={reduceMotion?false:{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:.3}}>
        <div className="menu-category-intro"><span>SELECTED CATEGORY</span><h3>{active.categoryName}</h3><p>{active.categoryDescription}</p></div>
        <ol>{active.items.map((item,index)=><li key={item.id}><span>{String(index+1).padStart(2,"0")}</span><div>{item.imageUrl&&<img className="menu-item-thumbnail" src={item.imageUrl} alt="" loading="lazy"/>}<h4>{item.itemName}</h4><p>{item.itemDescription}</p>{Array.isArray(item.tags)&&<div className="menu-item-tags">{item.tags.map(tag=><small key={tag}>{tag}</small>)}</div>}</div><b>{gil(item.price)}</b></li>)}</ol>
      </motion.div>}</AnimatePresence>
    </section>
    {showRoomEntry&&<section className="menu-room-entry"><div><span>PRIVATE ROOMS</span><h2>今晚想把哪一段相遇，留在包廂裡？</h2><p>查看店內共用與店員專屬包廂的照片、每節價格與使用說明。</p></div><a href="/menu/rooms">進入包廂介紹 <i>↗</i></a></section>}
  </div>;
}
