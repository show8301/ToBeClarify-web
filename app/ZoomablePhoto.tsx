"use client";

import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { AnimatePresence, animate as animateValue, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const ZOOM_STEPS = [1, 1.6, 2.4, 3.2] as const;

type ZoomablePhotoProps = {
  src:string;
  alt:string;
  placeholderSrc?:string;
  onSwipe?:(direction:-1|1)=>void;
};
type ZoomFocus = {x:number;y:number};

export default function ZoomablePhoto({src,alt,placeholderSrc,onSwipe}:ZoomablePhotoProps){
  const [zoomIndex,setZoomIndex]=useState(0);
  const [loaded,setLoaded]=useState(false);
  const [viewportSize,setViewportSize]=useState({width:0,height:0});
  const viewportRef=useRef<HTMLDivElement|null>(null);
  const swipeStart=useRef<{x:number;y:number;pointerId:number}|null>(null);
  const x=useMotionValue(0);
  const y=useMotionValue(0);
  const reduceMotion=useReducedMotion();
  const scale=ZOOM_STEPS[zoomIndex];
  const zoomed=zoomIndex>0;
  const dragBounds={
    left:-viewportSize.width*(scale-1)/2,
    right:viewportSize.width*(scale-1)/2,
    top:-viewportSize.height*(scale-1)/2,
    bottom:viewportSize.height*(scale-1)/2,
  };

  const movePosition=useCallback((nextX:number,nextY:number)=>{
    x.stop();y.stop();
    if(reduceMotion){x.set(nextX);y.set(nextY);return}
    animateValue(x,nextX,{type:"spring",stiffness:260,damping:28,mass:.8});
    animateValue(y,nextY,{type:"spring",stiffness:260,damping:28,mass:.8});
  },[reduceMotion,x,y]);
  const resetPosition=useCallback(()=>movePosition(0,0),[movePosition]);
  const setStep=useCallback((next:number,focus?:ZoomFocus)=>{
    const bounded=Math.max(0,Math.min(ZOOM_STEPS.length-1,next));
    const nextScale=ZOOM_STEPS[bounded];
    const maxX=viewportSize.width*(nextScale-1)/2;
    const maxY=viewportSize.height*(nextScale-1)/2;
    let nextX=x.get();
    let nextY=y.get();
    if(focus&&bounded>0){
      const contentX=(focus.x-nextX)/scale;
      const contentY=(focus.y-nextY)/scale;
      nextX=focus.x-contentX*nextScale;
      nextY=focus.y-contentY*nextScale;
    }
    nextX=Math.max(-maxX,Math.min(maxX,nextX));
    nextY=Math.max(-maxY,Math.min(maxY,nextY));
    setZoomIndex(bounded);
    if(bounded===0)resetPosition();else movePosition(nextX,nextY);
  },[movePosition,resetPosition,scale,viewportSize.height,viewportSize.width,x,y]);

  const focusFromPointer=useCallback((clientX:number,clientY:number):ZoomFocus=>{
    const rect=viewportRef.current?.getBoundingClientRect();
    if(!rect)return{x:0,y:0};
    return{x:clientX-rect.left-rect.width/2,y:clientY-rect.top-rect.height/2};
  },[]);

  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport)return;
    const observer=new ResizeObserver(([entry])=>{
      if(!entry)return;
      setViewportSize({width:entry.contentRect.width,height:entry.contentRect.height});
    });
    observer.observe(viewport);
    return()=>observer.disconnect();
  },[]);

  const handleWheel=(event:React.WheelEvent<HTMLDivElement>)=>{
    event.preventDefault();
    if(Math.abs(event.deltaY)<3)return;
    setStep(zoomIndex+(event.deltaY<0?1:-1),focusFromPointer(event.clientX,event.clientY));
  };
  const startSwipe=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(zoomed||!onSwipe||!event.isPrimary)return;
    swipeStart.current={x:event.clientX,y:event.clientY,pointerId:event.pointerId};
  };
  const finishSwipe=(event:React.PointerEvent<HTMLDivElement>)=>{
    const start=swipeStart.current;
    swipeStart.current=null;
    if(zoomed||!onSwipe||!start||start.pointerId!==event.pointerId)return;
    const offsetX=event.clientX-start.x;
    const offsetY=event.clientY-start.y;
    if(Math.abs(offsetX)>70&&Math.abs(offsetX)>Math.abs(offsetY)*1.25)onSwipe(offsetX<0?1:-1);
  };

  return <div ref={viewportRef} className={`zoom-photo${zoomed?" is-zoomed":""}`} onWheel={handleWheel} onPointerDown={startSwipe} onPointerUp={finishSwipe} onPointerCancel={()=>{swipeStart.current=null}}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={src}
        className="zoom-photo-canvas"
        drag={zoomed}
        dragConstraints={dragBounds}
        dragElastic={.04}
        dragMomentum={false}
        style={{x,y}}
        initial={reduceMotion?false:{opacity:0,scale:.94,filter:"blur(7px)"}}
        animate={{opacity:1,scale,filter:"blur(0px)"}}
        exit={reduceMotion?{opacity:0}:{opacity:0,scale:.97,filter:"blur(4px)"}}
        transition={{scale:{type:"spring",stiffness:260,damping:28,mass:.8},opacity:{duration:.22},filter:{duration:.26}}}
        onDoubleClick={(event)=>setStep(zoomed?0:2,focusFromPointer(event.clientX,event.clientY))}
      >
        {placeholderSrc&&placeholderSrc!==src&&<img className={`zoom-photo-placeholder${loaded?" is-hidden":""}`} src={placeholderSrc} alt="" aria-hidden="true"/>}
        <img className={loaded?"is-loaded":""} src={src} alt={alt} draggable={false} onLoad={()=>setLoaded(true)}/>
      </motion.div>
    </AnimatePresence>
    <div className="zoom-photo-hint" aria-live="polite"><Maximize2 aria-hidden="true"/><span>{zoomed?"拖曳移動 · 雙擊還原":"在目標上雙擊或滾輪放大"}</span></div>
    <div className="zoom-photo-controls" role="group" aria-label="照片縮放控制" onPointerDown={event=>event.stopPropagation()}>
      <button onClick={()=>setStep(zoomIndex-1)} disabled={zoomIndex===0} aria-label="縮小照片"><Minus aria-hidden="true"/></button>
      <output aria-label={`目前縮放 ${Math.round(scale*100)}%`}>{Math.round(scale*100)}%</output>
      <button onClick={()=>setStep(zoomIndex+1)} disabled={zoomIndex===ZOOM_STEPS.length-1} aria-label="放大照片"><Plus aria-hidden="true"/></button>
      <button className="zoom-photo-reset" onClick={()=>setStep(0)} disabled={!zoomed} aria-label="還原照片大小"><RotateCcw aria-hidden="true"/></button>
    </div>
  </div>;
}
