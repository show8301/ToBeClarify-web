"use client";

import { useState } from "react";
import type { Room, RoomsData } from "@/features/rooms/types";

const money=(value:number)=>value>0?`${new Intl.NumberFormat("zh-TW").format(value)} Gil`:`請洽店員`;
const ownershipLabel=(room:Room)=>room.ownershipType==="dedicated"?`店員專屬 · ${room.ownerStaffName||"指定店員"}`:"店內共用";

function RoomVisual({room,index}:{room:Room;index:number}){
  const [photoIndex,setPhotoIndex]=useState(0);
  const photos=room.photos.length?room.photos:[{id:`${room.id}-empty`,mediaId:null,imageUrl:"/og.png",sortOrder:0}];
  const current=photos[photoIndex%photos.length];
  const move=(delta:number)=>setPhotoIndex((value)=>(value+delta+photos.length)%photos.length);
  return <div className="room-visual">
    <img src={current.imageUrl||"/og.png"} alt={`${room.roomName} 空間照片 ${photoIndex+1}`} loading={index===0?"eager":"lazy"} decoding="async" onError={(event)=>{if(!event.currentTarget.src.endsWith("/og.png"))event.currentTarget.src="/og.png";}}/>
    <span className="room-visual-shade" aria-hidden="true"/>
    <span className="room-visual-counter">{String(photoIndex+1).padStart(2,"0")} / {String(photos.length).padStart(2,"0")} <i>← →</i></span>
    {photos.length>1?<><button className="room-visual-arrow is-prev" type="button" aria-label={`查看${room.roomName}上一張照片`} onClick={()=>move(-1)}>←</button><button className="room-visual-arrow is-next" type="button" aria-label={`查看${room.roomName}下一張照片`} onClick={()=>move(1)}>→</button></>:null}
    <div className="room-visual-dots" aria-label={`${room.roomName} 照片選擇`}>{photos.map((photo,photoNumber)=><button key={photo.id} type="button" aria-label={`查看第 ${photoNumber+1} 張照片`} className={photoNumber===photoIndex?"is-active":""} onClick={()=>setPhotoIndex(photoNumber)}/>)}</div>
  </div>;
}

function RoomCard({room,index,segmentMinutes}:{room:Room;index:number;segmentMinutes:number}){
  const paragraphs=(room.detailContent||"").split(/\n\s*\n/).map((value)=>value.trim()).filter(Boolean);
  return <article className="room-card">
    <RoomVisual room={room} index={index}/>
    <div className="room-card-copy">
      <div className="room-card-heading"><span>ROOM / {String(index+1).padStart(2,"0")}</span><h2>{room.roomName}</h2><b className={room.ownershipType==="dedicated"?"is-dedicated":"is-common"}>{ownershipLabel(room)}</b></div>
      <p className="room-card-intro">{room.shortDescription}</p>
      {paragraphs.length?<div className="room-card-detail">{paragraphs.map((paragraph,paragraphIndex)=><p key={`${room.id}-detail-${paragraphIndex}`}>{paragraph}</p>)}</div>:null}
      <div className="room-card-price"><span><small>每節時間</small><strong>{segmentMinutes} 分鐘</strong></span><span><small>使用價格</small><strong>{money(room.segmentPrice)} <em>/ 節</em></strong></span></div>
      <p className="room-card-note">包廂服務目前由店員協助訂購，請於入席前向現場店員確認空間與時段。</p>
    </div>
  </article>;
}

export default function RoomCatalog({data}:{data:RoomsData}){
  return <div className="room-page">
    <section className="room-hero"><div><span>PRIVATE ROOMS / {String(data.rooms.length).padStart(2,"0")} SPACES</span><h1>ROOM<br/><i>ARCHIVE</i></h1><p>在喧囂之外，替每一次相遇保留一個完整的場景。包廂屬性、每節價格與照片，先在這裡看見今晚的可能。</p></div><a href="/menu" className="room-hero-back">← 回到佳餚名錄</a></section>
    <section className="room-notice"><span>HOUSE NOTE</span><p>包廂以每節 {data.segmentMinutes} 分鐘計算。店內共用包廂可由當班店員協助安排；店員專屬包廂則以所屬店員的現場說明為準。</p></section>
    <section className="room-list" aria-label="包廂列表">{data.rooms.map((room,index)=><RoomCard key={room.id} room={room} index={index} segmentMinutes={data.segmentMinutes}/>)}</section>
    {!data.rooms.length?<div className="room-empty"><span>NO ROOMS YET</span><strong>今晚尚未公開包廂</strong><p>包廂資料會在後台完成設定後出現在這裡。</p></div>:null}
  </div>;
}
