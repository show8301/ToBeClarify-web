"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryAlbum } from "./site-types";

type GalleryPhoto = GalleryAlbum["items"][number];
const PHOTO_BATCH_SIZE = 4;

function GalleryImage({src,alt,loading="lazy"}:{src:string;alt:string;loading?:"eager"|"lazy"}){
  const [loaded,setLoaded]=useState(false);
  return <img className={loaded?"is-loaded":""} src={src} alt={alt} loading={loading} decoding="async" onLoad={()=>setLoaded(true)} onError={()=>setLoaded(true)}/>;
}

function GalleryCollage({photos,onSelect}:{photos:GalleryPhoto[];onSelect:(index:number)=>void}){
  const [visibleCount,setVisibleCount]=useState(()=>Math.min(PHOTO_BATCH_SIZE,photos.length));
  const loadMoreRef=useRef<HTMLSpanElement|null>(null);

  useEffect(()=>{
    const target=loadMoreRef.current;
    if(!target||visibleCount>=photos.length)return;
    const scrollRoot=target.closest(".weekly-modal-sheet");
    const observer=new IntersectionObserver(([entry])=>{
      if(!entry?.isIntersecting)return;
      setVisibleCount(count=>Math.min(count+PHOTO_BATCH_SIZE,photos.length));
    },{root:scrollRoot,rootMargin:"280px 0px"});
    observer.observe(target);
    return()=>observer.disconnect();
  },[photos.length,visibleCount]);

  return <>
    <div className="weekly-collage">{photos.slice(0,visibleCount).map((photo,index)=><button key={photo.id} onClick={()=>onSelect(index)} className={`photo-${index%5}`}><GalleryImage src={photo.thumbnailUrl||photo.imageUrl} alt={photo.title}/><span>{String(index+1).padStart(2,"0")}</span></button>)}</div>
    {visibleCount<photos.length&&<span ref={loadMoreRef} className="weekly-collage-sentinel" aria-hidden="true"><i/>LOADING MORE PHOTOS</span>}
  </>;
}

export default function GalleryArchive({albums,initialAlbumId=null}:{albums:GalleryAlbum[];initialAlbumId?:string|null}){
  const [selected,setSelected]=useState<GalleryAlbum|null>(()=>albums.find((album)=>album.id===initialAlbumId)??null);
  const [photoIndex,setPhotoIndex]=useState<number|null>(null);
  const reduceMotion=useReducedMotion();
  const dragControls=useDragControls();
  const sheetRef=useRef<HTMLDivElement|null>(null);
  const dragStartY=useRef<number|null>(null);
  const sheetTouchStartY=useRef<number|null>(null);
  const openedFromGallery=useRef(false);
  const photos=selected?.items??[];
  const syncAlbumFromPath=useCallback(()=>{
    const match=window.location.pathname.match(/^\/gallery\/([^/]+)\/?$/);
    const album=match?albums.find((item)=>item.id===decodeURIComponent(match[1])):null;
    setPhotoIndex(null);
    setSelected(album??null);
  },[albums]);
  const openAlbum=useCallback((album:GalleryAlbum)=>{
    openedFromGallery.current=true;
    window.history.pushState({galleryModal:true},"",`/gallery/${album.id}`);
    setSelected(album);
  },[]);
  const closeAlbum=useCallback(()=>{
    if(photoIndex!==null){setPhotoIndex(null);return}
    if(window.location.pathname.startsWith("/gallery/")&&openedFromGallery.current){
      openedFromGallery.current=false;
      window.history.back();
      return;
    }
    window.history.replaceState({},"","/gallery");
    setSelected(null);
  },[photoIndex]);
  const close=useCallback(()=>closeAlbum(),[closeAlbum]);
  const step=useCallback((amount:number)=>setPhotoIndex(index=>index===null||!photos.length?null:(index+amount+photos.length)%photos.length),[photos.length]);

  useEffect(()=>{
    setPhotoIndex(null);
    setSelected(initialAlbumId?albums.find((album)=>album.id===initialAlbumId)??null:null);
  },[albums,initialAlbumId]);
  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get("album");
    if(requested){
      const album=albums.find(item=>item.id===requested);
      if(album){window.history.replaceState({},"",`/gallery/${album.id}`);setSelected(album)}
    }
    window.addEventListener("popstate",syncAlbumFromPath);
    return()=>window.removeEventListener("popstate",syncAlbumFromPath);
  },[albums,syncAlbumFromPath]);
  useEffect(()=>{
    if(!selected)return;
    document.body.classList.add("modal-open");
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")close();if(photoIndex!==null&&event.key==="ArrowRight")step(1);if(photoIndex!==null&&event.key==="ArrowLeft")step(-1)};
    window.addEventListener("keydown",onKey);
    return()=>{document.body.classList.remove("modal-open");window.removeEventListener("keydown",onKey)};
  },[close,photoIndex,selected,step]);

  return <div className="weekly-page">
    <section className="weekly-hero">
      <span>FIELD NOTES FROM THE WAKING DREAM</span>
      <h1>EORZEA<br/><i>WEEKLY</i></h1>
      <div><b>{String(albums.length).padStart(2,"0")}</b><p>場夢境活動<br/>已收錄成冊</p></div>
      <p>以活動照片與短述保存清醒夢的每一個夜晚。翻開一期週報，重返當時的燭光、座席與相遇。</p>
    </section>

    <section className="weekly-grid" aria-label="活動相簿">
      {albums.map((album,index)=><motion.a href={`/gallery/${album.id}`} key={album.id} className={`weekly-card weekly-card-${index%4}`} onClick={(event)=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();openAlbum(album)}}} initial={reduceMotion?false:{opacity:0,y:35}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.15}} transition={{duration:.5,delay:Math.min(index*.08,.24),ease:[.22,1,.36,1]}}>
        <span className="weekly-card-photo"><GalleryImage src={album.coverImageUrl} alt={album.albumTitle}/><i>OPEN REPORT ↗</i></span>
        <span className="weekly-card-copy"><small>ISSUE / {String(index+1).padStart(2,"0")}</small><em>{album.periodText}</em><strong>{album.albumTitle}</strong><p>{album.albumDescription}</p><b>{String(album.items.length).padStart(2,"0")} PHOTOS</b></span>
      </motion.a>)}
    </section>

    <AnimatePresence>{selected&&<motion.div className="weekly-modal" role="dialog" aria-modal="true" aria-label={`${selected.albumTitle} 活動相簿`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.22}} onPointerDown={(event)=>{if(event.target===event.currentTarget)closeAlbum()}}>
      <motion.div ref={sheetRef} className="weekly-modal-sheet" drag="y" dragListener={false} dragControls={dragControls} dragConstraints={{top:0,bottom:0}} dragElastic={{top:0,bottom:.72}} onDragEnd={(_,info)=>{if(info.offset.y>95||info.velocity.y>650)closeAlbum()}} onTouchStart={(event)=>{sheetTouchStartY.current=(sheetRef.current?.scrollTop??0)<=0?event.touches[0]?.clientY??null:null}} onTouchEnd={(event)=>{const endY=event.changedTouches[0]?.clientY;const distance=sheetTouchStartY.current===null||endY===undefined?0:endY-sheetTouchStartY.current;sheetTouchStartY.current=null;if(distance>110)closeAlbum()}} onTouchCancel={()=>{sheetTouchStartY.current=null}} initial={false}>
        <button className="weekly-sheet-grabber" aria-label="向下拖曳關閉相簿" onPointerDown={(event)=>{if((sheetRef.current?.scrollTop??0)<=0){dragStartY.current=event.clientY;dragControls.start(event);event.currentTarget.setPointerCapture(event.pointerId)}}} onPointerUp={(event)=>{const distance=dragStartY.current===null?0:event.clientY-dragStartY.current;dragStartY.current=null;if(distance>85)closeAlbum()}} onPointerCancel={()=>{dragStartY.current=null}}><i/></button>
        <header><div><span>EORZEA WEEKLY · PHOTO REPORT</span><b>{selected.periodText}</b></div><button onClick={closeAlbum} aria-label="關閉相簿"><i>×</i></button></header>
        <div className="weekly-modal-intro"><span>THE STORY</span><h2>{selected.albumTitle}</h2><div className="weekly-modal-story"><p>{selected.albumDescription}</p>{selected.details.map((detail,index)=><p key={index}>{detail}</p>)}<b>{String(photos.length).padStart(2,"0")} VISUAL RECORDS</b></div></div>
        <GalleryCollage key={selected.id} photos={photos} onSelect={setPhotoIndex}/>
      </motion.div>
    </motion.div>}</AnimatePresence>

    <AnimatePresence>{selected&&photoIndex!==null&&photos[photoIndex]&&<motion.div className="weekly-photo-stage" role="dialog" aria-modal="true" aria-label={photos[photoIndex].title} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <header><span>{selected.albumTitle}</span><button onClick={()=>setPhotoIndex(null)}>BACK TO REPORT <i>×</i></button></header>
      <button className="weekly-photo-arrow prev" onClick={()=>step(-1)} aria-label="上一張">←</button>
      <motion.figure key={photos[photoIndex].id} drag="x" dragConstraints={{left:0,right:0}} dragElastic={.7} onDragEnd={(_,info)=>Math.abs(info.offset.x)>70&&step(info.offset.x<0?1:-1)} initial={reduceMotion?false:{opacity:0,scale:.94,rotate:-1}} animate={{opacity:1,scale:1,rotate:0}}><GalleryImage src={photos[photoIndex].imageUrl} alt={photos[photoIndex].title} loading="eager"/><figcaption><span>{photos[photoIndex].title}</span><b>{String(photoIndex+1).padStart(2,"0")} / {String(photos.length).padStart(2,"0")}</b></figcaption></motion.figure>
      <button className="weekly-photo-arrow next" onClick={()=>step(1)} aria-label="下一張">→</button>
    </motion.div>}</AnimatePresence>
  </div>;
}
