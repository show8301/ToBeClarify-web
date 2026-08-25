"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { MenuData } from "./site-types";

const gil=(value:number)=>`${new Intl.NumberFormat("zh-TW").format(value)} Gil`;

export default function MenuCatalog({menu}:{menu:MenuData}){
  const [category,setCategory]=useState(menu.categories[0]?.id??"");
  const reduceMotion=useReducedMotion();
  const active=menu.categories.find(item=>item.id===category)??menu.categories[0];
  return <div className="menu-page">
    <section className="menu-hero">
      <div><span>THE TASTE OF A WAKING DREAM</span><h1>NIGHT<br/><i>MENU</i></h1></div>
      <div className="menu-cover-card"><span>清醒夢 · LUCID DREAM</span><b>佳餚名錄</b><p>在每一場夜談之間，留一點溫度給餐桌。所有價格與組合皆由現行菜單 API 提供。</p><i>EDITION / 2026</i></div>
    </section>

    <section className="menu-pricing-rules">
      {menu.pricingRules.map((rule,index)=><article key={rule.id}><span>{String(index+1).padStart(2,"0")}</span><div><small>HOUSE CHARGE</small><h2>{rule.title}</h2><p>{rule.description}</p></div><b>{rule.priceText}</b></article>)}
    </section>

    <section className="menu-sets">
      <header><div><span>CURATED SETS</span><h2>今夜套餐</h2></div><p>主餐、甜點與飲品已為不同的相遇節奏搭配成席。</p></header>
      <div>{menu.sets.map((set,index)=><motion.article key={set.id} initial={reduceMotion?false:{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.15}} transition={{delay:index*.07}}>
        <span className="menu-set-photo">{set.imageUrl?<img src={set.imageUrl} alt={set.setName}/>:<i>LD</i>}<small>SET / {String(index+1).padStart(2,"0")}</small></span>
        <div><h3>{set.setName}</h3><p>{set.setDescription}</p><ul>{set.items.map(item=><li key={item.id}><span>{item.itemRole.toUpperCase()}</span><b>{item.itemName}</b></li>)}</ul><strong>{gil(set.setPrice)}</strong></div>
      </motion.article>)}</div>
    </section>

    <section className="menu-catalog">
      <header><div><span>À LA CARTE</span><h2>單點選集</h2></div><nav aria-label="菜單分類">{menu.categories.map(item=><button key={item.id} className={item.id===active?.id?"active":""} onClick={()=>setCategory(item.id)}>{item.categoryName}<i>{String(item.items.length).padStart(2,"0")}</i></button>)}</nav></header>
      <AnimatePresence mode="wait">{active&&<motion.div key={active.id} className="menu-category" initial={reduceMotion?false:{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:.3}}>
        <div className="menu-category-intro"><span>SELECTED CATEGORY</span><h3>{active.categoryName}</h3><p>{active.categoryDescription}</p></div>
        <ol>{active.items.map((item,index)=><li key={item.id}><span>{String(index+1).padStart(2,"0")}</span><div><h4>{item.itemName}</h4><p>{item.itemDescription}</p></div><b>{item.priceText||gil(item.price)}</b></li>)}</ol>
      </motion.div>}</AnimatePresence>
    </section>
  </div>;
}
