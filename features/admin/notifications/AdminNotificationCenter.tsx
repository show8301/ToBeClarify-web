"use client";
import type {NotificationCenterValue,NotificationRule,NotificationSettings,NotificationInbox,NotificationDelivery,NotificationCapabilities,NotificationSound,NotificationChange,BroadcastSendRequest,BroadcastSendResult,BroadcastReceiptSummary} from '@/features/admin/notifications/types';
import {NotificationApiError} from '@/features/admin/notifications/api';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {useAdminAuth} from '@/features/admin/auth/AdminAuthContext.jsx';
import {adminApi} from '@/features/admin/api/client.js';
import {AdminButton,AdminField,AdminPage,AdminPanel,AdminToggle} from '@/features/admin/shared/AdminShared.jsx';
import {notificationRequest,notificationSoundUrl} from '@/features/admin/notifications/api';

const Context=createContext<NotificationCenterValue|null>(null);
const labels:Record<NotificationRule['ruleType'],string>={
  order_received:'收到點餐訂單',
  designated_order_received:'收到 Someone／ALL 指名訂單',
  nomination_starting:'指名時段開始前提醒',
  nomination_ending:'指名時段結束前提醒',
  nomination_ended:'指名時段結束後提醒',
  business_opening_soon:'預定開店前提醒',
  business_closing_soon:'預定關店前提醒',
  champagne_order_received:'收到香檳塔訂單',
  order_backlog:'待處理訂單堆積',
};
const personalRuleTypes:NotificationRule['ruleType'][]=['order_received','designated_order_received','nomination_starting','nomination_ending','nomination_ended','business_opening_soon','business_closing_soon','champagne_order_received'];
const broadcastRuleTypes:NotificationRule['ruleType'][]=['order_received','champagne_order_received','order_backlog'];
const targetRuleTypes:NotificationRule['ruleType'][]=['designated_order_received','nomination_starting','nomination_ending','nomination_ended'];
const offsetRuleTypes:NotificationRule['ruleType'][]=['nomination_starting','nomination_ending','nomination_ended','business_opening_soon','business_closing_soon'];
function useLeader(account:string){
  const leader=useRef(false);
  const [isLeader,setIsLeader]=useState(false);
  const setLeader=(value:boolean)=>{if(leader.current===value)return;leader.current=value;setIsLeader(value);};
  useEffect(()=>{
    let stopped=false;let release:(()=>void)|undefined;const id=crypto.randomUUID();let channel:BroadcastChannel|undefined;let timer:ReturnType<typeof setInterval>|undefined;
    if(navigator.locks){
      const claim=()=>{if(stopped||leader.current)return;void navigator.locks.request(`lucid-notification-leader:${account}`,{ifAvailable:true},async lock=>{if(!lock||stopped)return;setLeader(true);await new Promise<void>(resolve=>{release=resolve;});setLeader(false);});};
      claim();timer=setInterval(claim,3000);
    }else if(typeof BroadcastChannel!=='undefined'){
      channel=new BroadcastChannel(`lucid-notifications:${account}`);const peers=new Map<string,number>();
      channel.onmessage=e=>{if(typeof e.data==='string')peers.set(e.data,Date.now());};
      const elect=()=>{peers.set(id,Date.now());for(const [key,time] of peers)if(Date.now()-time>10000)peers.delete(key);setLeader([...peers.keys()].sort()[0]===id);channel?.postMessage(id);};timer=setInterval(elect,3000);elect();
    }else setLeader(document.visibilityState==='visible');
    return()=>{stopped=true;setLeader(false);clearInterval(timer);release?.();channel?.close();};
  },[account]);return {ref:leader,isLeader};
}
function OrderLink({item}:{item:NotificationDelivery}){
  if(!item.content.orderId||item.content.action==='open_notifications')return null;
  const label=item.content.action==='view_nomination'?'查看指名':'查看訂單';
  const suffix=item.content.action==='view_nomination'?'#nominations':'';
  return <a href={`/admin/notifications/orders/${encodeURIComponent(item.content.orderId)}${suffix}`}>{label}</a>;
}
function presentationKey(item:NotificationDelivery){return `${item.id}:${item.content.presentationId||item.content.occurrenceNo||1}`;}
export function AdminNotificationProvider({children}:{children:React.ReactNode}){
  const {user}=useAdminAuth();const account=user?.id||user?.loginName||'current';const leaderState=useLeader(account);const leader=leaderState.ref;
  const [inbox,setInbox]=useState<NotificationInbox>({items:[],unreadCount:0});const [state,setState]=useState('連線中');const [toasts,setToasts]=useState<NotificationDelivery[]>([]);const [critical,setCritical]=useState<NotificationDelivery[]>([]);
  const [enabled,setEnabled]=useState(false);const [audioError,setAudioError]=useState('');const [desktop,setDesktop]=useState(false);
  const audio=useRef<AudioContext|null>(null),queue=useRef(Promise.resolve()),queued=useRef(0),prefs=useRef({enabled,desktop});
  useEffect(()=>{prefs.current={enabled,desktop};},[enabled,desktop]);
  const presented=useRef(new Set<string>());const cursor=useRef('');const active=useRef(true);
  const enableAudio=async()=>{try{audio.current??=new AudioContext();await audio.current.resume();setEnabled(audio.current.state==='running');setAudioError('');}catch{setAudioError('此裝置無法啟用音效，請檢查瀏覽器設定。');}};
  const play=(delivery:NotificationDelivery)=>{
    if(!prefs.current.enabled||!delivery.content.soundId||queued.current>=3)return;
    queued.current++;
    queue.current=queue.current.then(async()=>{try{if(!active.current||!audio.current)return;
      const response=await fetch(notificationSoundUrl(delivery.content.soundId!),{credentials:'include',cache:'no-store'});if(!response.ok)throw new Error();
      const buffer=await audio.current.decodeAudioData(await response.arrayBuffer());if(!active.current||audio.current.state!=='running')throw new Error();
      const source=audio.current.createBufferSource();source.buffer=buffer;source.connect(audio.current.destination);source.start();await new Promise<void>(resolve=>{source.onended=()=>resolve();});
    }catch{if(active.current)setAudioError('通知已收到，但音效不可用。請檢查音效與裝置設定。');}finally{queued.current--;}});
  };
  useEffect(()=>{
    active.current=true;let stopped=false,baseline=true;let timer:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();let stream:EventSource|undefined;let streamCapable=false;
    cursor.current='';presented.current.clear();
    // Account/leader changes must clear account-scoped UI before opening the new subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInbox({items:[],unreadCount:0});setToasts([]);setCritical([]);setState('連線中');
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel(`lucid-notification-events:${account}`):undefined;
    const enqueueCritical=(items:NotificationDelivery[])=>setCritical(current=>{
      const activeItems=items.filter(x=>x.content.requiresAck&&!x.acknowledgedAt&&!x.withdrawnAt&&new Date(x.expiresAt)>new Date());
      const incoming=new Map(activeItems.map(item=>[item.id,item]));
      const retained=current.filter(item=>!incoming.has(item.id));
      return [...retained,...activeItems];
    });
    const receive=(next:NotificationInbox,allowPresentation=true,shared=false)=>{
      if(stopped)return;if(next.snapshotCursor)cursor.current=next.snapshotCursor;setInbox(next);setState('已連線');
      const validIds=new Set(next.items.filter(x=>new Date(x.expiresAt)>new Date()&&!x.withdrawnAt).map(x=>x.id));
      setToasts(current=>current.filter(x=>validIds.has(x.id)));
      setCritical(current=>current.filter(x=>validIds.has(x.id)));
      if(!shared)channel?.postMessage({type:'inbox',inbox:next});
      if(baseline){
        next.items.forEach(x=>presented.current.add(presentationKey(x)));
        if(leader.current)enqueueCritical(next.items);
        // Personal history is not replayed, but active critical broadcasts
        // must be restored until the recipient acknowledges them.
        baseline=false;
        return;
      }
      if(allowPresentation&&leader.current){
        for(const item of [...next.items].reverse()){
          const itemKey=presentationKey(item);
          if(presented.current.has(itemKey)||item.readAt||item.withdrawnAt||new Date(item.expiresAt)<=new Date())continue;
          const storageKey=`lucid-notification:${account}:${itemKey}`;
          try{if(localStorage.getItem(storageKey))continue;localStorage.setItem(storageKey,String(Date.now()));}catch{/* Storage may be unavailable; retain in-memory deduplication. */}
          presented.current.add(itemKey);channel?.postMessage({type:'presented',key:itemKey});
          if(item.content.requiresAck&&item.content.popupMode==='critical_modal')enqueueCritical([item]);
          else if(item.content.popupMode!=='none'){
            setToasts(current=>[...current.filter(x=>x.id!==item.id),item].slice(-3));
            if(prefs.current.desktop&&document.visibilityState==='hidden'&&Notification.permission==='granted')new Notification('清醒夢店內通知',{body:'有新的點餐通知，請返回後台查看。',tag:itemKey,silent:true});
          }
          play(item);
        }
      }
    };
    channel?.addEventListener('message',event=>{
      const data=event.data as {type?:string;inbox?:NotificationInbox;key?:string};
      if(data.type==='inbox'&&data.inbox)receive(data.inbox,false,true);
      if(data.type==='presented'&&data.key)presented.current.add(data.key);
    });
    const pollOnce=async()=>{
      try{receive(await notificationRequest<NotificationInbox>('',undefined,{signal:controller.signal}));}
      catch(error){if(stopped)return;const status=error instanceof NotificationApiError?error.status:0;setState(status===401?'登入已失效':'連線中斷，稍後重試');if(status===401){setInbox({items:[],unreadCount:0});setToasts([]);setCritical([]);cursor.current='';void audio.current?.close().catch(()=>{});}}};
    const connectStream=()=>{
      if(stopped||!streamCapable||typeof EventSource==='undefined')return;
      const query=cursor.current?`?cursor=${encodeURIComponent(cursor.current)}`:'';
      stream?.close();stream=new EventSource(`/api/admin/notifications/stream${query}`);
      stream.addEventListener('inbox',event=>{try{receive(JSON.parse((event as MessageEvent<string>).data) as NotificationInbox);}catch{setState('通知資料異常');}});
      stream.addEventListener('change',event=>{try{const change=JSON.parse((event as MessageEvent<string>).data) as NotificationChange;if(change.changeType)setState('已連線');}catch{setState('通知資料異常');}});
      stream.addEventListener('resync',()=>{void pollOnce();});
      stream.onerror=()=>{stream?.close();stream=undefined;if(!stopped){setState('串流重連中');void pollOnce();clearTimeout(timer);timer=setTimeout(connectStream,15000);}};
    };
    const poll=async()=>{await pollOnce();if(!stopped)timer=setTimeout(poll,15000);};
    void notificationRequest<NotificationCapabilities>('/capabilities',undefined,{signal:controller.signal}).then(cap=>{if(stopped)return;if(!cap.enabled){setState('通知尚未啟用');return;}
      streamCapable=(cap.delivery==='sse'||cap.delivery==='sse-v2')&&typeof EventSource!=='undefined';
      if(streamCapable)connectStream();else void poll();}).catch(()=>{if(!stopped)setState('通知服務尚未就緒');});
    return()=>{stopped=true;active.current=false;controller.abort();stream?.close();channel?.close();clearTimeout(timer);void audio.current?.close().catch(()=>{});audio.current=null;};
  },[account,leaderState.isLeader,leader]);
  const refresh=async()=>{const next=await notificationRequest<NotificationInbox>();if(next.snapshotCursor)cursor.current=next.snapshotCursor;setInbox(next);};
  const loadMore=async()=>{if(!inbox.nextPageToken)return;const next=await notificationRequest<NotificationInbox>(`?pageToken=${encodeURIComponent(inbox.nextPageToken)}&limit=100`);if(next.snapshotCursor)cursor.current=next.snapshotCursor;setInbox(current=>{const seen=new Set(current.items.map(item=>item.id));return {...next,items:[...current.items,...next.items.filter(item=>!seen.has(item.id))]};});};
  const read=async (ids:string[])=>{await notificationRequest('/read',{ids});await refresh();};
  const acknowledge=async(id:string)=>{await notificationRequest(`/${encodeURIComponent(id)}/acknowledge`,{}, {method:'POST'});await refresh();setCritical(current=>current.filter(x=>x.id!==id));};
  return <Context.Provider value={{inbox,state,read,acknowledge,loadMore,enableAudio,enabled,audioError,desktop,enableDesktop:async()=>{if(!('Notification'in window))return;const permission=await Notification.requestPermission();setDesktop(permission==='granted');}}}>{children}<div className="notification-banners" aria-live="polite">{toasts.filter(item=>item.content.isBroadcast).map(item=><NotificationToast key={item.id} item={item} onClose={()=>setToasts(current=>current.filter(x=>x.id!==item.id))}/>)}</div><div className="notification-toasts" aria-live="polite">{toasts.filter(item=>!item.content.isBroadcast).map(item=><NotificationToast key={item.id} item={item} onClose={()=>setToasts(current=>current.filter(x=>x.id!==item.id))}/>)}</div>{critical[0]&&<NotificationCriticalModal item={critical[0]} onAcknowledge={acknowledge}/>}</Context.Provider>;
}
function NotificationToast({item,onClose}:{item:NotificationDelivery;onClose:()=>void}){
  const [paused,setPaused]=useState(false);
  useEffect(()=>{if(item.content.popupMode!=='toast'||paused)return;const timer=setTimeout(onClose,6000);return()=>clearTimeout(timer);},[item.id,item.content.popupMode,paused,onClose]);
  return <article className={item.content.isBroadcast?'is-broadcast':''} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={()=>setPaused(false)}><b>{item.content.isBroadcast?'店內廣播 · ':''}{item.content.title}</b>{item.content.occurrenceNo&&item.content.occurrenceNo>1&&<small>第 {item.content.occurrenceNo} 次提醒</small>}<p>{item.content.message}</p><OrderLink item={item}/><button aria-label="關閉通知提示" onClick={onClose}>×</button></article>;
}
function NotificationCriticalModal({item,onAcknowledge}:{item:NotificationDelivery;onAcknowledge:(id:string)=>Promise<void>}){
  const button=useRef<HTMLButtonElement|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{button.current?.focus();},[item.id]);
  const acknowledge=async()=>{setBusy(true);setError('');try{await onAcknowledge(item.id);}catch(e){setError(e instanceof Error?e.message:'確認失敗');}finally{setBusy(false);}};
  // The dialog itself owns the Tab/Escape focus trap; the keyboard listener is intentional.
  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
  return <div className="notification-critical-backdrop"><section className="notification-critical-modal" role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby={`notification-critical-title-${item.id}`} onKeyDown={event=>{if(event.key==='Escape'||event.key==='Tab'){event.preventDefault();button.current?.focus();}}}><span>緊急店內廣播</span><h2 id={`notification-critical-title-${item.id}`}>{item.content.title}</h2>{item.content.occurrenceNo&&item.content.occurrenceNo>1&&<small>第 {item.content.occurrenceNo} 次提醒</small>}<p>{item.content.message}</p>{error&&<p role="alert">{error}</p>}<button ref={button} type="button" disabled={busy} onClick={()=>void acknowledge()}>{busy?'送出中…':'已知道'}</button></section></div>;
}
export function AdminNotificationBell(){
  const center=useContext(Context);const [open,setOpen]=useState(false);const [error,setError]=useState('');if(!center)return null;
  return <div className="notification-bell"><button onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={`通知，${center.inbox.unreadCount} 筆未讀`}>通知 {center.inbox.unreadCount}</button>{open&&<aside className="notification-drawer" aria-label="通知收件匣"><h2>通知</h2><p>{center.state}</p><a href="/admin/notifications">通知設定</a>{error&&<p role="alert">{error}</p>}<button onClick={()=>void center.read(center.inbox.items.filter(x=>!x.readAt&&!x.withdrawnAt).map(x=>x.id)).catch(e=>setError((e instanceof Error?e.message:'操作失敗')))}>目前清單全部已讀</button>{center.inbox.items.length===0&&<p>尚無通知。</p>}{center.inbox.items.map(item=><article key={item.id} className={item.withdrawnAt?'is-withdrawn':''}><b>{item.content.isBroadcast?'店內廣播 · ':''}{item.content.title}</b><p>{item.content.message}</p><small>{new Date(item.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}{item.withdrawnAt?' · 已撤回':new Date(item.expiresAt)<=new Date()?' · 已過期':item.acknowledgedAt?' · 已知道':''}</small><OrderLink item={item}/>{!item.readAt&&!item.withdrawnAt&&<button onClick={()=>void center.read([item.id]).catch(e=>setError((e instanceof Error?e.message:'操作失敗')))}>標為已讀</button>}{item.content.requiresAck&&!item.acknowledgedAt&&!item.withdrawnAt&&new Date(item.expiresAt)>new Date()&&<button onClick={()=>void center.acknowledge(item.id).catch(e=>setError((e instanceof Error?e.message:'確認失敗')))}>已知道</button>}</article>)}{center.inbox.hasMore&&<button onClick={()=>void center.loadMore().catch(e=>setError((e instanceof Error?e.message:'載入失敗')))}>載入更多</button>}</aside>}</div>;
}
export function AdminNotificationsPage(){
  const {user}=useAdminAuth();const center=useContext(Context);const [broadcast,setBroadcast]=useState(false);const [settings,setSettings]=useState<NotificationSettings>({revision:0,schemaVersion:2,rules:[]});
  const [sounds,setSounds]=useState<NotificationSound[]>([]),[staff,setStaff]=useState<{id:string;displayName:string}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false);
  const [manual,setManual]=useState<BroadcastSendRequest>(()=>({idempotencyKey:crypto.randomUUID(),title:'',message:'',audienceMode:'all',audienceStaffIds:[],audienceRoles:[],priority:'normal',expiresAfterMinutes:15,soundId:'',action:'open_notifications',requiresAck:false,emergency:false,reason:''}));
  const [lastBroadcastId,setLastBroadcastId]=useState('');const [receipt,setReceipt]=useState<BroadcastReceiptSummary|null>(null);
  const [file,setFile]=useState<File|null>(null),[name,setName]=useState(''),[systemCode,setSystemCode]=useState('');const [caps,setCaps]=useState<NotificationCapabilities|null>(null);const preview=useRef<HTMLAudioElement|null>(null);const [reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    // Loading the selected scope is an external synchronization boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    const staffRequest=adminApi.getStaffMembers(controller.signal).catch(()=>[]);
    void Promise.all([
      notificationRequest<NotificationSettings>(`/settings?broadcast=${broadcast}`,undefined,{signal:controller.signal}),
      notificationRequest<NotificationSound[]>('/sounds',undefined,{signal:controller.signal}),
      notificationRequest<NotificationCapabilities>('/capabilities',undefined,{signal:controller.signal}),
      staffRequest,
    ]).then(([s,a,c,staffItems])=>{if(!controller.signal.aborted){
      const normalizedStaff=Array.isArray(staffItems)?(staffItems as unknown[]).map(item=>{const record=item&&typeof item==='object'?item as Record<string,unknown>:{};const id=String(record.id??record.staffId??record.staffMemberId??'');return {id,displayName:String(record.displayName??record.nickname??record.name??record.id??'')};}).filter(item=>item.id&&item.displayName):[];
      setSettings(s);setSounds(a);setCaps(c);setStaff(normalizedStaff);setDirty(false);setBusy(false);
    }})
      .catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'操作失敗');setBusy(false);}});
    return()=>{controller.abort();preview.current?.pause();};
  },[broadcast,reload]);
  useEffect(()=>{if(!dirty)return undefined;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const changeScope=(value:boolean)=>{if(value===broadcast)return;if(dirty&&!window.confirm('目前有尚未儲存的通知草稿，切換頁籤會捨棄草稿。要繼續嗎？'))return;setBusy(true);setError('');setMessage('');setDirty(false);setSettings({revision:0,schemaVersion:2,rules:[]});setBroadcast(value);};
  const update=(index:number,key:keyof NotificationRule,value:NotificationRule[keyof NotificationRule])=>{setDirty(true);setSettings(current=>({...current,rules:current.rules.map((x,i)=>i===index?{...x,[key]:value}:x)}));};
  const mutateRules=(mutator:(rules:NotificationRule[])=>NotificationRule[])=>{setDirty(true);setSettings(current=>({...current,rules:mutator(current.rules)}));};
  const makeRule=(ruleType:NotificationRule['ruleType']):NotificationRule=>({id:crypto.randomUUID(),name:labels[ruleType],ruleType,isEnabled:!broadcast,popupMode:broadcast?'banner':'toast',soundId:null,audienceMode:'all',audienceStaffIds:[],audienceRoles:[],priority:'normal',expiresAfterMinutes:15,templateCode:broadcast?ruleType:null,requiresAck:false,repeatIntervalMinutes:0,maxOccurrences:1,backlogThreshold:1,backlogDurationMinutes:5,targetMode:targetRuleTypes.includes(ruleType)?'self':null,targetStaffId:null,offsetMinutes:offsetRuleTypes.includes(ruleType)?0:null});
  const save=async()=>{setBusy(true);setError('');try{setSettings(await notificationRequest<NotificationSettings>(`/settings?broadcast=${broadcast}`,{schemaVersion:settings.schemaVersion??2,expectedRevision:settings.revision,rules:settings.rules},{method:'PUT'}));setDirty(false);setMessage('通知設定已儲存。');}catch(e){setError(e instanceof NotificationApiError&&e.status===409?'設定已被其他變更，已保留目前草稿；請重新載入後比對再儲存。':(e instanceof Error?e.message:'操作失敗'));}finally{setBusy(false);}};
  const sendManual=async()=>{if(!manual.title.trim()||!manual.message.trim()||!manual.soundId||(manual.emergency&&!manual.reason.trim())){setError(manual.emergency?'緊急廣播需要標題、原因、內容與系統音效。':'手動廣播需要標題、內容與系統音效。');return;}if(manual.emergency&&!window.confirm('緊急廣播會以阻擋式視窗要求每位收件者逐人按「已知道」，確定要發送嗎？'))return;setBusy(true);setError('');try{const result=await notificationRequest<BroadcastSendResult>('/broadcasts/send',manual,{method:'POST'});setLastBroadcastId(result.broadcastId);setReceipt(null);setMessage(result.alreadySent?`此 idempotency key 已送出過，保留 ${result.recipientCount} 位收件者。`:`廣播已排入發送，已快照 ${result.recipientCount} 位收件者。`);setManual(current=>({...current,idempotencyKey:crypto.randomUUID(),title:'',message:'',reason:''}));}catch(e){setError(e instanceof Error?e.message:'廣播發送失敗');}finally{setBusy(false);}};
  const loadReceipt=async()=>{if(!lastBroadcastId)return;setBusy(true);setError('');try{setReceipt(await notificationRequest<BroadcastReceiptSummary>(`/broadcasts/${encodeURIComponent(lastBroadcastId)}/receipts`));}catch(e){setError(e instanceof Error?e.message:'目前尚無可查詢的收件進度。');}finally{setBusy(false);}};
  const withdrawLast=async()=>{if(!lastBroadcastId||!window.confirm('撤回後尚未確認的廣播將解除阻擋，確定撤回嗎？'))return;setBusy(true);setError('');try{const result=await notificationRequest<{affectedDeliveryCount:number;alreadyWithdrawn:boolean}>(`/broadcasts/${encodeURIComponent(lastBroadcastId)}/withdraw`,{}, {method:'POST'});setMessage(result.alreadyWithdrawn?'此廣播已撤回。':`廣播已撤回，更新 ${result.affectedDeliveryCount} 張通知卡。`);await loadReceipt();}catch(e){setError(e instanceof Error?e.message:'廣播撤回失敗');}finally{setBusy(false);}};
  function updateManual<K extends keyof BroadcastSendRequest>(key:K,value:BroadcastSendRequest[K]){setManual(current=>({...current,[key]:value}));}
  const upload=async()=>{if(!file)return;setBusy(true);setError('');const body=new FormData();body.append('file',file);body.append('name',name);if(systemCode)body.append('systemCode',systemCode);try{const sound=await notificationRequest<NotificationSound>('/sounds',body);setSounds(current=>[...current,sound]);setFile(null);setMessage('音效已上傳。');}catch(e){setError((e instanceof Error?e.message:'操作失敗'));}finally{setBusy(false);}};
  const deleteSound=async(sound:NotificationSound)=>{if(!sound.canDelete||!window.confirm(`確定刪除「${sound.name}」？已被規則或待發送通知使用的音效會拒絕刪除。`))return;setBusy(true);setError('');try{await notificationRequest(`/sounds/${encodeURIComponent(sound.id)}`,{}, {method:'DELETE'});setSounds(current=>current.filter(item=>item.id!==sound.id));setMessage(`音效「${sound.name}」已停用。`);}catch(e){setError(e instanceof Error?e.message:'音效刪除失敗');}finally{setBusy(false);}};
  const selectableSounds=sounds.filter(sound=>!broadcast||Boolean(sound.systemCode));const configuredTypes=settings.rules.map(rule=>rule.ruleType);const advertisedTypes=broadcast?(caps?.broadcastRuleTypes??caps?.ruleTypes??broadcastRuleTypes):(caps?.personalRuleTypes??caps?.ruleTypes??personalRuleTypes);const supportedTypes=broadcast?broadcastRuleTypes:personalRuleTypes;const availableTypes=Array.from(new Set([...advertisedTypes.map(type=>supportedTypes.includes(type as NotificationRule['ruleType'])?type as NotificationRule['ruleType']:null),...configuredTypes])).filter((type):type is NotificationRule['ruleType']=>type!==null);
  const reloadSettings=()=>{if(dirty&&!window.confirm('目前有尚未儲存的通知草稿，重新載入會捨棄草稿。要繼續嗎？'))return;setDirty(false);setBusy(true);setError('');setReload(value=>value+1);};
  return <AdminPage title="通知中心" eyebrow="Notifications" description="設定點餐、指名、營業時段與香檳塔提醒；關閉彈窗不代表接單或取消訂單。"><div className="notification-center"><div className="adminTabs"><button type="button" disabled={busy} onClick={()=>changeScope(false)}>我的通知</button>{['manager','developer'].includes(user?.role||'')&&<button type="button" disabled={busy} onClick={()=>changeScope(true)}>店內廣播</button>}</div>
    {error&&<p className="adminNotice" role="alert">{error}</p>}{message&&<p className="adminNotice" role="status">{message}</p>}
    <AdminPanel title="本裝置"><p>{center?.state}</p><AdminButton onClick={center?.enableAudio}>{center?.enabled?'音效已啟用':'啟用音效'}</AdminButton><AdminButton onClick={center?.enableDesktop}>{center?.desktop?'桌面通知已允許':'允許桌面通知'}</AdminButton>{center?.audioError&&<p role="alert">{center.audioError}</p>}<p>離開後台或登出後停止提醒；首次載入不重播歷史通知。</p></AdminPanel>
    <AdminPanel title={broadcast?'店內廣播規則':'我的規則'} description={broadcast?'管理者可設定既有事件廣播的受眾、優先級、有效期與逐人已知道；已送出的廣播可撤回。':`只影響目前登入帳號。可新增相同類型但不同目標或 N 分鐘的規則（最多 ${settings.rules.length}/20 條）。`}>
      {settings.rules.map((rule,index)=><div className="notification-rule" key={rule.id}><div className="notification-rule-header"><div><h3>{labels[rule.ruleType]??rule.ruleType}</h3><small>規則 {index+1} · {rule.isEnabled?'已啟用':'未啟用'}</small></div><AdminToggle ariaLabel={`${labels[rule.ruleType]??rule.ruleType}啟用`} label="啟用" checked={rule.isEnabled} onChange={(v:boolean)=>update(index,'isEnabled',v)}/></div><div className="notification-rule-grid">
        {broadcast&&<AdminField label="規則名稱"><input value={rule.name??''} maxLength={120} onChange={e=>update(index,'name',e.target.value)}/></AdminField>}
        {broadcast&&<AdminField label="廣播受眾" hint="發送事件發生時快照帳號；預設包含未關聯店員的有效管理帳號。"><select value={rule.audienceMode??'all'} onChange={e=>{const mode=e.target.value as NonNullable<NotificationRule['audienceMode']>;update(index,'audienceMode',mode);if(mode!=='staff')update(index,'audienceStaffIds',[]);if(mode!=='roles')update(index,'audienceRoles',[]);}}><option value="all">所有有效後台帳號</option><option value="working_today">今日上班店員</option><option value="roles">今日上班指定角色</option><option value="staff">指定店員</option></select>{rule.audienceMode==='staff'&&<select multiple aria-label="選擇廣播店員" value={rule.audienceStaffIds??[]} onChange={e=>update(index,'audienceStaffIds',Array.from(e.target.selectedOptions,option=>option.value))}>{staff.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select>}{rule.audienceMode==='roles'&&<select multiple aria-label="選擇廣播角色" value={rule.audienceRoles??[]} onChange={e=>update(index,'audienceRoles',Array.from(e.target.selectedOptions,option=>option.value))}><option value="service">服務員</option><option value="designated">指名人員</option><option value="backstage">幕後</option></select>}</AdminField>}
        {broadcast&&<AdminField label="優先級"><select value={rule.priority??'normal'} onChange={e=>update(index,'priority',e.target.value)}><option value="normal">一般</option><option value="high">高優先</option></select></AdminField>}
        {broadcast&&<AdminField label="逐人確認"><label><input type="checkbox" checked={Boolean(rule.requiresAck)} onChange={e=>{update(index,'requiresAck',e.target.checked);update(index,'popupMode',e.target.checked?'critical_modal':'banner');}}/> 需要每位收件者按「已知道」</label></AdminField>}
        {broadcast&&<AdminField label="有效期（分鐘）" hint="發送後 1–1440 分鐘；已送出的廣播可由管理者撤回。"><input type="number" min="1" max="1440" step="1" value={rule.expiresAfterMinutes??15} onChange={e=>update(index,'expiresAfterMinutes',Math.max(1,Math.min(1440,Math.round(Number(e.target.value)||15))))}/></AdminField>}
        {broadcast&&<AdminField label="重複提醒間隔（分鐘）" hint="填 0 表示不重複；啟用重複時至少 1 分鐘。"><input type="number" min="0" max="1440" step="1" value={rule.repeatIntervalMinutes??0} onChange={e=>{const value=Math.max(0,Math.min(1440,Math.round(Number(e.target.value)||0)));update(index,'repeatIntervalMinutes',value);if(value===0)update(index,'maxOccurrences',1);}}/></AdminField>}
        {broadcast&&<AdminField label="最多提醒次數" hint="包含第一次提醒，範圍 1–5 次。"><input type="number" min="1" max="5" step="1" value={rule.maxOccurrences??1} disabled={!rule.repeatIntervalMinutes} onChange={e=>update(index,'maxOccurrences',Math.max(1,Math.min(5,Math.round(Number(e.target.value)||1))))}/></AdminField>}
        {broadcast&&rule.ruleType==='order_backlog'&&<AdminField label="堆積門檻 K／持續 M 分鐘" hint="待店內確認訂單達 K 筆並持續 M 分鐘後才發出；數量下降低於 K 會重置 episode。"><div className="notification-inline-fields"><input aria-label="待處理訂單門檻 K" type="number" min="1" step="1" value={rule.backlogThreshold??1} onChange={e=>update(index,'backlogThreshold',Math.max(1,Math.round(Number(e.target.value)||1)))}/><input aria-label="待處理訂單持續 M 分鐘" type="number" min="1" max="1440" step="1" value={rule.backlogDurationMinutes??5} onChange={e=>update(index,'backlogDurationMinutes',Math.max(1,Math.min(1440,Math.round(Number(e.target.value)||5))))}/></div></AdminField>}
        {!broadcast&&<AdminField label="彈窗方式" hint="提示顯示方式與音效分開設定。"><select value={rule.popupMode} onChange={e=>update(index,'popupMode',e.target.value)}><option value="none">不彈窗（只保留收件匣）</option><option value="toast">一般提示（自動收起）</option><option value="sticky">置頂提示（直到關閉）</option></select></AdminField>}
        <AdminField label="音效"><div className="notification-sound-control"><button type="button" className={`notification-sound-button ${rule.soundId?'is-set':''}`} aria-label={rule.soundId?'已設定音效，按一下取消音效':'尚未設定音效，按一下套用第一個可用音效'} title={rule.soundId?'已設定音效：按一下取消':'未設定音效：按一下套用第一個可用音效'} onClick={()=>{if(rule.soundId)update(index,'soundId',null);else if(selectableSounds[0])update(index,'soundId',selectableSounds[0].id);else setError('目前沒有可用音效，請先上傳或等待系統音效載入。')}}><span className="notification-sound-glyph" aria-hidden="true">🔔</span></button><select aria-label="選擇通知音效" value={rule.soundId||''} onChange={e=>update(index,'soundId',e.target.value||null)}><option value="">無音效</option>{selectableSounds.map(sound=><option key={sound.id} value={sound.id}>{sound.name}</option>)}</select></div></AdminField>
        {!broadcast&&targetRuleTypes.includes(rule.ruleType)&&<AdminField label="指名對象" hint="Someone 可選自己或指定店員；ALL 代表所有人的指名。"><select value={rule.targetMode||'self'} onChange={e=>{const mode=e.target.value as NonNullable<NotificationRule['targetMode']>;update(index,'targetMode',mode);if(mode!=='staff')update(index,'targetStaffId',null);}}><option value="self">自己被指名（Someone）</option><option value="all">所有人被指名（ALL）</option><option value="staff">指定店員被指名（Someone）</option></select>{rule.targetMode==='staff'&&<select aria-label="選擇被監看的店員" value={rule.targetStaffId||''} onChange={e=>update(index,'targetStaffId',e.target.value||null)}><option value="">選擇店員</option>{staff.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select>}</AdminField>}
        {!broadcast&&offsetRuleTypes.includes(rule.ruleType)&&<AdminField label="N（分鐘）" hint="可填 0；範圍 0–1440 分鐘。"><input type="number" min="0" max="1440" step="1" value={rule.offsetMinutes??0} onChange={e=>update(index,'offsetMinutes',Math.max(0,Math.min(1440,Number(e.target.value)||0)))}/></AdminField>}
      </div><div className="notification-rule-actions"><AdminButton variant="ghost" disabled={busy} onClick={()=>mutateRules(rules=>{const copy={...rules[index],id:crypto.randomUUID(),schemaVersion:undefined,ruleRevision:undefined,fingerprint:undefined};return [...rules.slice(0,index+1),copy,...rules.slice(index+1)];})}>複製</AdminButton><AdminButton variant="danger" disabled={busy} onClick={()=>mutateRules(rules=>rules.filter((_,i)=>i!==index))}>移除</AdminButton>{!broadcast&&<><AdminButton variant="ghost" disabled={busy||index===0} onClick={()=>mutateRules(rules=>{const next=[...rules];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>上移</AdminButton><AdminButton variant="ghost" disabled={busy||index===settings.rules.length-1} onClick={()=>mutateRules(rules=>{const next=[...rules];[next[index],next[index+1]]=[next[index+1],next[index]];return next;})}>下移</AdminButton></>}</div></div>)}
      {availableTypes.map(type=><AdminButton key={type} variant="secondary" disabled={busy||settings.rules.length>=20} onClick={()=>mutateRules(rules=>[...rules,makeRule(type)])}>＋{labels[type]}</AdminButton>)}{settings.rules.length>=20&&<p className="adminFieldHint">已達 20 條上限；請複製或編輯現有規則。</p>}<div className="notification-rule-toolbar"><AdminButton disabled={busy||!dirty} onClick={save}>儲存設定</AdminButton><AdminButton variant="ghost" disabled={busy} onClick={reloadSettings}>重新載入</AdminButton></div>
    </AdminPanel>
    {broadcast&&<AdminPanel title="手動店內廣播" description="純文字、受控通知中心動作；送出時快照受眾帳號。相同 idempotency key 重試不會建立第二筆正式廣播。緊急廣播會逐人要求確認。"><div className="notification-rule-grid"><AdminField label="標題"><input value={manual.title} maxLength={120} onChange={e=>updateManual('title',e.target.value)}/></AdminField><AdminField label="優先級"><select value={manual.priority} disabled={manual.emergency} onChange={e=>updateManual('priority',e.target.value as BroadcastSendRequest['priority'])}><option value="normal">一般</option><option value="high">高優先</option></select></AdminField><AdminField label="內容" className="span-2"><textarea value={manual.message} maxLength={2000} rows={4} onChange={e=>updateManual('message',e.target.value)}/></AdminField><AdminField label="緊急廣播" hint="全員、高優先、阻擋式視窗；發送前仍需再次確認。"><label><input type="checkbox" checked={manual.emergency} onChange={e=>{const emergency=e.target.checked;setManual(current=>({...current,emergency,requiresAck:emergency||current.requiresAck,audienceMode:emergency?'all':current.audienceMode,audienceStaffIds:emergency?[]:current.audienceStaffIds,audienceRoles:emergency?[]:current.audienceRoles,priority:emergency?'high':current.priority}));}}/> 需要每位收件者按「已知道」</label></AdminField>{manual.emergency&&<AdminField label="緊急原因" className="span-2"><textarea value={manual.reason} maxLength={500} rows={2} onChange={e=>updateManual('reason',e.target.value)}/></AdminField>}<AdminField label="廣播受眾" hint="不依賴登入狀態；發送時固定收件帳號。緊急廣播固定為所有有效後台帳號。"><select value={manual.emergency?'all':manual.audienceMode} disabled={manual.emergency} onChange={e=>{const mode=e.target.value as BroadcastSendRequest['audienceMode'];updateManual('audienceMode',mode);if(mode!=='staff')updateManual('audienceStaffIds',[]);if(mode!=='roles')updateManual('audienceRoles',[]);}}><option value="all">所有有效後台帳號</option><option value="working_today">今日上班店員</option><option value="roles">今日上班指定角色</option><option value="staff">指定店員</option></select>{!manual.emergency&&manual.audienceMode==='staff'&&<select multiple aria-label="選擇手動廣播店員" value={manual.audienceStaffIds} onChange={e=>updateManual('audienceStaffIds',Array.from(e.target.selectedOptions,option=>option.value))}>{staff.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select>}{!manual.emergency&&manual.audienceMode==='roles'&&<select multiple aria-label="選擇手動廣播角色" value={manual.audienceRoles} onChange={e=>updateManual('audienceRoles',Array.from(e.target.selectedOptions,option=>option.value))}><option value="service">服務員</option><option value="designated">指名人員</option><option value="backstage">幕後</option></select>}</AdminField><AdminField label="有效期（分鐘）"><input type="number" min="1" max="1440" step="1" value={manual.expiresAfterMinutes} onChange={e=>updateManual('expiresAfterMinutes',Math.max(1,Math.min(1440,Math.round(Number(e.target.value)||15))))}/></AdminField><AdminField label="系統音效"><select value={manual.soundId} onChange={e=>updateManual('soundId',e.target.value)}><option value="">選擇音效</option>{selectableSounds.map(sound=><option key={sound.id} value={sound.id}>{sound.name}</option>)}</select></AdminField></div><p className="adminFieldHint">每次編輯內容會沿用目前送出草稿的 idempotency key；送出成功後自動產生新的 key。</p><AdminButton disabled={busy||!manual.title.trim()||!manual.message.trim()||!manual.soundId||(manual.emergency&&!manual.reason.trim())} onClick={sendManual}>{manual.emergency?'發送緊急廣播':'發送店內廣播'}</AdminButton>{lastBroadcastId&&<div className="notification-receipt-panel"><p>最近廣播實例：{lastBroadcastId}</p><AdminButton variant="ghost" disabled={busy} onClick={loadReceipt}>查詢確認進度</AdminButton><AdminButton variant="danger" disabled={busy} onClick={withdrawLast}>撤回廣播</AdminButton>{receipt&&<p>收件 {receipt.recipientCount} · 已讀 {receipt.readCount} · 未讀 {receipt.unreadCount} · 已知道 {receipt.acknowledgedCount} · 待確認 {receipt.pendingAcknowledgementCount} · 到期未確認 {receipt.expiredUnacknowledgedCount} · 已撤回 {receipt.withdrawnCount}</p>}</div>}</AdminPanel>}
    <AdminPanel title="音效庫" description="按鈕中的靜態鈴鐺代表未設定音效；有聲規則會以鈴鐺動畫提示。每個規則可獨立選擇音效。系統音效不能刪除；個人音效採停用，不影響既有通知歷史。">{sounds.map(sound=><p key={sound.id}>{sound.name} · {sound.durationMs/1000} 秒 <button type="button" onClick={()=>{preview.current?.pause();preview.current=new Audio(notificationSoundUrl(sound.id));preview.current.play().catch(()=>setError('無法播放此音效。'));}}>試聽</button><button type="button" onClick={()=>preview.current?.pause()}>停止</button>{sound.canDelete&&<button type="button" disabled={busy} onClick={()=>void deleteSound(sound)}>刪除</button>}</p>)}{!caps?.soundUploadConfigured&&<p>音效解析器尚未配置，暫時無法上傳。</p>}<AdminField label="音效名稱"><input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></AdminField><AdminField label="音檔（Ogg/Opus 或 MP3，最多 5 秒／1 MiB）"><input type="file" accept=".ogg,.mp3" onChange={e=>setFile(e.target.files?.[0]||null)}/></AdminField>{user?.role==='developer'&&<AdminField label="系統音效代碼（留空為個人音效）" hint="基礎代碼：order_chime、time_reminder、store_broadcast；可增加其他代碼。"><input value={systemCode} pattern="[a-z][a-z0-9_]*" onChange={e=>setSystemCode(e.target.value)}/></AdminField>}<AdminButton disabled={busy||!file||!name.trim()||!caps?.soundUploadConfigured} onClick={upload}>上傳音效</AdminButton></AdminPanel>
  </div></AdminPage>;
}
