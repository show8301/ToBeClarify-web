"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { GuestbookComment, GuestbookPage } from "@/features/site/types";

const dateLabel=(value:string)=>new Intl.DateTimeFormat("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Taipei"}).format(new Date(value));

export default function GuestbookWall({initial}:{initial:GuestbookPage}){
  const [comments,setComments]=useState(initial.items);
  const [page,setPage]=useState(initial.page);
  const [total,setTotal]=useState(initial.totalCount);
  const [displayName,setDisplayName]=useState("");
  const [userToken,setUserToken]=useState("");
  const [content,setContent]=useState("");
  const [replyingTo,setReplyingTo]=useState<string|null>(null);
  const [replyContent,setReplyContent]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const reduceMotion=useReducedMotion();
  const pinned=useMemo(()=>comments.filter((comment)=>comment.isPinned),[comments]);
  const regular=useMemo(()=>comments.filter((comment)=>!comment.isPinned),[comments]);

  const reload=async()=>{
    const response=await fetch("/api/guestbook?page=1",{cache:"no-store"});
    if(!response.ok)return;
    const data=await response.json() as GuestbookPage;
    setComments(data.items);setPage(data.page);setTotal(data.totalCount);
  };
  const submit=async(event:React.FormEvent,commentId?:string)=>{
    event.preventDefault();
    const message=commentId?replyContent:content;
    if(!displayName.trim()||!userToken.trim()||!message.trim()){setStatus("請先填妥暱稱、識別碼與內容。");return}
    setBusy(true);setStatus("正在將訊息留在夢境裡…");
    try{
      const response=await fetch(commentId?`/api/guestbook/${commentId}/replies`:"/api/guestbook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName,content:message,userToken})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||"送出失敗");
      setContent("");setReplyContent("");setReplyingTo(null);setStatus(commentId?"回覆已留下。":"留言已送出，謝謝你為今晚留下紀錄。");
      await reload();
    }catch(error){setStatus(error instanceof Error?error.message:"留言服務暫時無法使用")}
    finally{setBusy(false)}
  };
  const loadMore=async()=>{
    setBusy(true);
    try{
      const response=await fetch(`/api/guestbook?page=${page+1}`);
      if(!response.ok)throw new Error();
      const data=await response.json() as GuestbookPage;
      setComments((current)=>[...current,...data.items.filter((item)=>!current.some((existing)=>existing.id===item.id))]);
      setPage(data.page);setTotal(data.totalCount);
    }finally{setBusy(false)}
  };

  const card=(comment:GuestbookComment,index:number)=><motion.article className={`guest-note${comment.isPinned?" pinned":""}`} key={comment.id} initial={reduceMotion?false:{opacity:0,y:24,rotate:index%2?.4:-.4}} whileInView={{opacity:1,y:0,rotate:0}} viewport={{once:true,amount:.12}} transition={{duration:.45,delay:Math.min(index*.035,.2)}}>
    <header><span>{comment.isPinned?"PINNED NOTE":"TRAVELER NOTE"}</span><b>{dateLabel(comment.createdAt)}</b></header>
    <h2>{comment.displayName}</h2><p>{comment.content}</p>
    {comment.replies.length>0&&<div className="guest-replies">{comment.replies.map((reply)=><blockquote key={reply.id}><span>↳ {reply.displayName}</span><p>{reply.content}</p><time>{dateLabel(reply.createdAt)}</time></blockquote>)}</div>}
    <button className="guest-reply-toggle" onClick={()=>{setReplyingTo(value=>value===comment.id?null:comment.id);setReplyContent("")}} aria-expanded={replyingTo===comment.id}>REPLY <i>{replyingTo===comment.id?"−":"↗"}</i></button>
    {replyingTo===comment.id&&<form className="guest-inline-reply" onSubmit={(event)=>submit(event,comment.id)}><label><span>回覆內容</span><textarea value={replyContent} onChange={(event)=>setReplyContent(event.target.value)} maxLength={500} placeholder={`回覆 ${comment.displayName}…`}/></label><button disabled={busy}>留下回覆 ↗</button></form>}
  </motion.article>;

  return <div className="guestbook-page">
    <section className="guestbook-hero"><span>WORDS LEFT BETWEEN WAKING AND DREAM</span><h1>AFTER<br/><i>GLOW</i></h1><div><b>{String(total).padStart(2,"0")}</b><p>則旅人留言<br/>留在夢境之後</p></div><p>寫下今晚的片段、給店員的一句話，或下一次想實現的夢。請不要留下現實世界的個人資料。</p></section>
    <section className="guestbook-layout">
      <aside className="guest-composer"><span>LEAVE A NOTE · 留言</span><h2>讓這個夜晚<br/>多留一會。</h2><form onSubmit={(event)=>submit(event)}><label><span>旅人暱稱</span><input value={displayName} onChange={(event)=>setDisplayName(event.target.value)} maxLength={40} autoComplete="nickname" placeholder="如何稱呼你？"/></label><label><span>投稿識別碼</span><input type="password" value={userToken} onChange={(event)=>setUserToken(event.target.value)} autoComplete="off" placeholder="用於投稿與回覆"/></label><label><span>想留下的話</span><textarea value={content} onChange={(event)=>setContent(event.target.value)} maxLength={500} placeholder="寫下不含現實個資的感想…"/></label><button disabled={busy}>SEND TO THE DREAM <i>↗</i></button></form><p aria-live="polite">{status||"識別碼只隨本次投稿送出，不會保存在這個頁面。"}</p></aside>
      <div className="guestbook-feed">
        {pinned.length>0&&<section className="guest-pinned"><header><span>FROM THE COUNTER</span><b>{pinned.length} PINNED</b></header>{pinned.map(card)}</section>}
        <section className="guest-notes"><header><span>RECENT AFTERGLOW</span><b>{regular.length} / {total}</b></header>{regular.map(card)}</section>
        {comments.length<total&&<button className="guest-load-more" disabled={busy} onClick={loadMore}>LOAD MORE MEMORIES <i>＋</i></button>}
      </div>
    </section>
  </div>;
}
