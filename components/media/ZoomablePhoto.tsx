"use client";

import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { AnimatePresence, animate as animateValue, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const ZOOM_STEPS = [1, 1.6, 2.4, 3.2] as const;
const MIN_SCALE=ZOOM_STEPS[0];
const MAX_SCALE=ZOOM_STEPS[ZOOM_STEPS.length-1];

type ZoomablePhotoProps = {
  src:string;
  alt:string;
  placeholderSrc?:string;
  onSwipe?:(direction:-1|1)=>void;
};
type ZoomFocus = {x:number;y:number};
type PinchGesture = {startDistance:number;startScale:number;contentX:number;contentY:number};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const distance=(a:ZoomFocus,b:ZoomFocus)=>Math.hypot(a.x-b.x,a.y-b.y);

export default function ZoomablePhoto({src,alt,placeholderSrc,onSwipe}:ZoomablePhotoProps){
  const [scale,setScale]=useState<number>(MIN_SCALE);
  const [loaded,setLoaded]=useState(false);
  const [pinching,setPinching]=useState(false);
  const [viewportSize,setViewportSize]=useState({width:0,height:0});
  const viewportRef=useRef<HTMLDivElement|null>(null);
  const swipeStart=useRef<{x:number;y:number;pointerId:number}|null>(null);
  const activeTouches=useRef(new Map<number,ZoomFocus>());
  const pinchGesture=useRef<PinchGesture|null>(null);
  const x=useMotionValue(0);
  const y=useMotionValue(0);
  const scaleValue=useMotionValue<number>(MIN_SCALE);
  const reduceMotion=useReducedMotion();
  const zoomed=scale>MIN_SCALE+.01;
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
  const setZoom=useCallback((requestedScale:number,focus?:ZoomFocus,animate=true)=>{
    const nextScale=clamp(requestedScale,MIN_SCALE,MAX_SCALE);
    const currentScale=scaleValue.get();
    const maxX=viewportSize.width*(nextScale-1)/2;
    const maxY=viewportSize.height*(nextScale-1)/2;
    let nextX=x.get();
    let nextY=y.get();
    if(focus&&nextScale>MIN_SCALE){
      const contentX=(focus.x-nextX)/currentScale;
      const contentY=(focus.y-nextY)/currentScale;
      nextX=focus.x-contentX*nextScale;
      nextY=focus.y-contentY*nextScale;
    }
    nextX=clamp(nextX,-maxX,maxX);
    nextY=clamp(nextY,-maxY,maxY);
    setScale(nextScale);
    scaleValue.stop();
    if(nextScale===MIN_SCALE)resetPosition();else if(animate)movePosition(nextX,nextY);else{x.stop();y.stop();x.set(nextX);y.set(nextY)}
    if(reduceMotion||!animate)scaleValue.set(nextScale);
    else animateValue(scaleValue,nextScale,{type:"spring",stiffness:260,damping:28,mass:.8});
  },[movePosition,reduceMotion,resetPosition,scaleValue,viewportSize.height,viewportSize.width,x,y]);

  const stepZoom=useCallback((direction:-1|1,focus?:ZoomFocus)=>{
    const current=scaleValue.get();
    const next=direction>0
      ? ZOOM_STEPS.find(step=>step>current+.05)??MAX_SCALE
      : [...ZOOM_STEPS].reverse().find(step=>step<current-.05)??MIN_SCALE;
    setZoom(next,focus);
  },[scaleValue,setZoom]);

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
    stepZoom(event.deltaY<0?1:-1,focusFromPointer(event.clientX,event.clientY));
  };
  const handlePointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.pointerType==="touch"){
      event.currentTarget.setPointerCapture(event.pointerId);
      activeTouches.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(activeTouches.current.size===2){
        const [a,b]=[...activeTouches.current.values()];
        const midpoint=focusFromPointer((a.x+b.x)/2,(a.y+b.y)/2);
        const currentScale=scaleValue.get();
        x.stop();y.stop();scaleValue.stop();
        pinchGesture.current={
          startDistance:Math.max(distance(a,b),1),
          startScale:currentScale,
          contentX:(midpoint.x-x.get())/currentScale,
          contentY:(midpoint.y-y.get())/currentScale,
        };
        swipeStart.current=null;
        setPinching(true);
        return;
      }
    }
    if(zoomed||!onSwipe||!event.isPrimary)return;
    swipeStart.current={x:event.clientX,y:event.clientY,pointerId:event.pointerId};
  };
  const handlePointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.pointerType!=="touch"||!activeTouches.current.has(event.pointerId))return;
    activeTouches.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const gesture=pinchGesture.current;
    if(!gesture||activeTouches.current.size<2)return;
    const [a,b]=[...activeTouches.current.values()];
    const midpoint=focusFromPointer((a.x+b.x)/2,(a.y+b.y)/2);
    const nextScale=clamp(gesture.startScale*distance(a,b)/gesture.startDistance,MIN_SCALE,MAX_SCALE);
    const maxX=viewportSize.width*(nextScale-1)/2;
    const maxY=viewportSize.height*(nextScale-1)/2;
    const nextX=clamp(midpoint.x-gesture.contentX*nextScale,-maxX,maxX);
    const nextY=clamp(midpoint.y-gesture.contentY*nextScale,-maxY,maxY);
    x.set(nextX);y.set(nextY);scaleValue.set(nextScale);setScale(nextScale);
  };
  const handlePointerEnd=(event:React.PointerEvent<HTMLDivElement>)=>{
    const wasPinching=pinchGesture.current!==null;
    if(event.pointerType==="touch")activeTouches.current.delete(event.pointerId);
    if(wasPinching){
      pinchGesture.current=null;
      swipeStart.current=null;
      setPinching(false);
      if(scaleValue.get()<MIN_SCALE+.02)setZoom(MIN_SCALE);
      return;
    }
    const start=swipeStart.current;
    swipeStart.current=null;
    if(zoomed||!onSwipe||!start||start.pointerId!==event.pointerId)return;
    const offsetX=event.clientX-start.x;
    const offsetY=event.clientY-start.y;
    if(Math.abs(offsetX)>70&&Math.abs(offsetX)>Math.abs(offsetY)*1.25)onSwipe(offsetX<0?1:-1);
  };
  const cancelPointers=()=>{
    activeTouches.current.clear();pinchGesture.current=null;swipeStart.current=null;setPinching(false);
  };

  return <div ref={viewportRef} className={`zoom-photo${zoomed?" is-zoomed":""}${pinching?" is-pinching":""}`} onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={cancelPointers}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={src}
        className="zoom-photo-canvas"
        drag={zoomed&&!pinching}
        dragConstraints={dragBounds}
        dragElastic={.04}
        dragMomentum={false}
        style={{x,y,scale:scaleValue}}
        initial={reduceMotion?false:{opacity:0,filter:"blur(7px)"}}
        animate={{opacity:1,filter:"blur(0px)"}}
        exit={reduceMotion?{opacity:0}:{opacity:0,filter:"blur(4px)"}}
        transition={{opacity:{duration:.22},filter:{duration:.26}}}
        onDoubleClick={(event)=>setZoom(zoomed?MIN_SCALE:2.4,focusFromPointer(event.clientX,event.clientY))}
      >
        {placeholderSrc&&placeholderSrc!==src&&<img className={`zoom-photo-placeholder${loaded?" is-hidden":""}`} src={placeholderSrc} alt="" aria-hidden="true"/>}
        <img className={loaded?"is-loaded":""} src={src} alt={alt} draggable={false} onLoad={()=>setLoaded(true)}/>
      </motion.div>
    </AnimatePresence>
    <div className="zoom-photo-hint" aria-live="polite"><Maximize2 aria-hidden="true"/><span>{pinching?"雙指縮放中":zoomed?"拖曳移動 · 雙指開闔":"雙指開闔 · 雙擊或滾輪放大"}</span></div>
    <div className="zoom-photo-controls" role="group" aria-label="照片縮放控制" onPointerDown={event=>event.stopPropagation()}>
      <button onClick={()=>stepZoom(-1)} disabled={!zoomed} aria-label="縮小照片"><Minus aria-hidden="true"/></button>
      <output aria-label={`目前縮放 ${Math.round(scale*100)}%`}>{Math.round(scale*100)}%</output>
      <button onClick={()=>stepZoom(1)} disabled={scale>=MAX_SCALE-.01} aria-label="放大照片"><Plus aria-hidden="true"/></button>
      <button className="zoom-photo-reset" onClick={()=>setZoom(MIN_SCALE)} disabled={!zoomed} aria-label="還原照片大小"><RotateCcw aria-hidden="true"/></button>
    </div>
  </div>;
}
