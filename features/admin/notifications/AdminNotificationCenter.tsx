"use client";
import type {NotificationCenterValue,NotificationRule,NotificationSettings,NotificationInbox,NotificationDelivery,NotificationCapabilities,NotificationSound} from '@/features/admin/notifications/types';
import {NotificationApiError} from '@/features/admin/notifications/api';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {useAdminAuth} from '@/features/admin/auth/AdminAuthContext.jsx';
import {AdminButton,AdminField,AdminPage,AdminPanel,AdminToggle} from '@/features/admin/shared/AdminShared.jsx';
import {notificationRequest,notificationSoundUrl} from '@/features/admin/notifications/api';

const Context=createContext<NotificationCenterValue|null>(null);
const labels:Record<NotificationRule['ruleType'],string>={order_received:'收到點餐訂單',champagne_order_received:'收到香檳塔訂單'};
function useLeader(account:string){
  const leader=useRef(false);
  useEffect(()=>{
    let stopped=false;let release:(()=>void)|undefined;const id=crypto.randomUUID();let channel:BroadcastChannel|undefined;let timer:ReturnType<typeof setInterval>|undefined;
    if(navigator.locks){
      const claim=()=>{if(stopped||leader.current)return;void navigator.locks.request(`lucid-notification-leader:${account}`,{ifAvailable:true},async lock=>{if(!lock||stopped)return;leader.current=true;await new Promise<void>(resolve=>{release=resolve;});leader.current=false;});};
      claim();timer=setInterval(claim,3000);
    }else if(typeof BroadcastChannel!=='undefined'){
      channel=new BroadcastChannel(`lucid-notifications:${account}`);const peers=new Map<string,number>();
      channel.onmessage=e=>{if(typeof e.data==='string')peers.set(e.data,Date.now());};
      const elect=()=>{peers.set(id,Date.now());for(const [key,time] of peers)if(Date.now()-time>10000)peers.delete(key);leader.current=[...peers.keys()].sort()[0]===id;channel?.postMessage(id);};timer=setInterval(elect,3000);channel?.postMessage(id);
    }else leader.current=document.visibilityState==='visible';
    return()=>{stopped=true;leader.current=false;clearInterval(timer);release?.();channel?.close();};
  },[account]);return leader;
}
export function AdminNotificationProvider({children}:{children:React.ReactNode}){
  const {user}=useAdminAuth();const account=user?.id||user?.loginName||'current';const leader=useLeader(account);
  const [inbox,setInbox]=useState<NotificationInbox>({items:[],unreadCount:0});const [state,setState]=useState('連線中');const [toasts,setToasts]=useState<NotificationDelivery[]>([]);
  const [enabled,setEnabled]=useState(false);const [audioError,setAudioError]=useState('');const [desktop,setDesktop]=useState(false);
  const audio=useRef<AudioContext|null>(null),queue=useRef(Promise.resolve()),queued=useRef(0),prefs=useRef({enabled,desktop});
  useEffect(()=>{prefs.current={enabled,desktop};},[enabled,desktop]);
  const presented=useRef(new Set<string>());const active=useRef(true);
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
    active.current=true;let stopped=false,baseline=true;let timer:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();let stream:EventSource|undefined;
    const receive=(next:NotificationInbox)=>{
        if(stopped)return;setInbox(next);setState('已連線');
        const validIds=new Set(next.items.filter(x=>new Date(x.expiresAt)>new Date()).map(x=>x.id));
        setToasts(current=>current.filter(x=>validIds.has(x.id)));
        if(!baseline&&leader.current){
          for(const item of [...next.items].reverse()){
            if(presented.current.has(item.id)||item.readAt||new Date(item.expiresAt)<=new Date())continue;
            const key=`lucid-notification:${account}:${item.id}`;
            try{if(localStorage.getItem(key))continue;localStorage.setItem(key,String(Date.now()));}catch{/* Storage may be unavailable; retain in-memory deduplication. */}
            presented.current.add(item.id);
            if(item.content.popupMode!=='none'){
              setToasts(current=>[...current,item].slice(-3));
              if(prefs.current.desktop&&document.visibilityState==='hidden'&&Notification.permission==='granted')new Notification('清醒夢店內通知',{body:'有新的點餐通知，請返回後台查看。',tag:item.id,silent:true});
            }
            play(item);
          }
        }
        // First connection loads history without replaying offline sounds or popups.
        if(baseline){next.items.forEach(x=>presented.current.add(x.id));baseline=false;}
    };
    const poll=async()=>{
      try{receive(await notificationRequest<NotificationInbox>('',undefined,{signal:controller.signal}));}catch(error){if(stopped)return;setState((error instanceof NotificationApiError?error.status:0)===401?'登入已失效':'連線中斷，稍後重試');if((error instanceof NotificationApiError?error.status:0)===401){setInbox({items:[],unreadCount:0});setToasts([]);void audio.current?.close().catch(()=>{});return;}}
      if(!stopped)timer=setTimeout(poll,15000);
    };
    void notificationRequest<NotificationCapabilities>('/capabilities',undefined,{signal:controller.signal}).then(cap=>{if(stopped)return;if(!cap.enabled){setState('通知尚未啟用');return;}
      if(cap.delivery==='sse'&&typeof EventSource!=='undefined'){
        stream=new EventSource('/api/admin/notifications/stream');
        stream.addEventListener('inbox',event=>{try{receive(JSON.parse((event as MessageEvent<string>).data) as NotificationInbox);}catch{setState('通知資料異常');}});
        stream.onerror=()=>{stream?.close();stream=undefined;if(!stopped)void poll();};
      }else void poll();}).catch(()=>{if(!stopped)setState('通知服務尚未就緒');});
    return()=>{stopped=true;active.current=false;controller.abort();stream?.close();clearTimeout(timer);void audio.current?.close().catch(()=>{});audio.current=null;};
  },[account,leader]);
  const read=async (ids:string[])=>{await notificationRequest('/read',{ids});setInbox(await notificationRequest<NotificationInbox>());};
  return <Context.Provider value={{inbox,state,read,enableAudio,enabled,audioError,desktop,enableDesktop:async()=>{if(!('Notification'in window))return;const permission=await Notification.requestPermission();setDesktop(permission==='granted');}}}>{children}<div className="notification-banners" aria-live="polite">{toasts.filter(item=>item.content.isBroadcast).map(item=><NotificationToast key={item.id} item={item} onClose={()=>setToasts(current=>current.filter(x=>x.id!==item.id))}/>)}</div><div className="notification-toasts" aria-live="polite">{toasts.filter(item=>!item.content.isBroadcast).map(item=><NotificationToast key={item.id} item={item} onClose={()=>setToasts(current=>current.filter(x=>x.id!==item.id))}/>)}</div></Context.Provider>;
}
function NotificationToast({item,onClose}:{item:NotificationDelivery;onClose:()=>void}){
  const [paused,setPaused]=useState(false);
  useEffect(()=>{if(item.content.popupMode!=='toast'||paused)return;const timer=setTimeout(onClose,6000);return()=>clearTimeout(timer);},[item.id,item.content.popupMode,paused,onClose]);
  return <article className={item.content.isBroadcast?'is-broadcast':''} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={()=>setPaused(false)}><b>{item.content.isBroadcast?'店內廣播 · ':''}{item.content.title}</b><p>{item.content.message}</p><a href={`/admin/notifications/orders/${encodeURIComponent(item.content.orderId)}`}>查看訂單</a><button aria-label="關閉通知提示" onClick={onClose}>×</button></article>;
}
export function AdminNotificationBell(){
  const center=useContext(Context);const [open,setOpen]=useState(false);const [error,setError]=useState('');if(!center)return null;
  return <div className="notification-bell"><button onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={`通知，${center.inbox.unreadCount} 筆未讀`}>通知 {center.inbox.unreadCount}</button>{open&&<aside className="notification-drawer" aria-label="通知收件匣"><h2>通知</h2><p>{center.state}</p><a href="/admin/notifications">通知設定</a>{error&&<p role="alert">{error}</p>}<button onClick={()=>void center.read(center.inbox.items.filter(x=>!x.readAt).map(x=>x.id)).catch(e=>setError((e instanceof Error?e.message:'操作失敗')))}>目前清單全部已讀</button>{center.inbox.items.length===0&&<p>尚無通知。</p>}{center.inbox.items.map(item=><article key={item.id}><b>{item.content.title}</b><p>{item.content.message}</p><small>{new Date(item.createdAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}{new Date(item.expiresAt)<=new Date()?' · 已過期':''}</small><a href={`/admin/notifications/orders/${encodeURIComponent(item.content.orderId)}`}>查看訂單</a>{!item.readAt&&<button onClick={()=>void center.read([item.id]).catch(e=>setError((e instanceof Error?e.message:'操作失敗')))}>標為已讀</button>}</article>)}</aside>}</div>;
}
export function AdminNotificationsPage(){
  const {user}=useAdminAuth();const center=useContext(Context);const [broadcast,setBroadcast]=useState(false);const [settings,setSettings]=useState<NotificationSettings>({revision:0,rules:[]});
  const [sounds,setSounds]=useState<NotificationSound[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[message,setMessage]=useState('');
  const [file,setFile]=useState<File|null>(null),[name,setName]=useState(''),[systemCode,setSystemCode]=useState('');const [caps,setCaps]=useState<NotificationCapabilities|null>(null);const preview=useRef<HTMLAudioElement|null>(null);const [reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    void Promise.all([
      notificationRequest<NotificationSettings>(`/settings?broadcast=${broadcast}`,undefined,{signal:controller.signal}),
      notificationRequest<NotificationSound[]>('/sounds',undefined,{signal:controller.signal}),
      notificationRequest<NotificationCapabilities>('/capabilities',undefined,{signal:controller.signal})
    ]).then(([s,a,c])=>{if(!controller.signal.aborted){setSettings(s);setSounds(a);setCaps(c);setBusy(false);}})
      .catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'操作失敗');setBusy(false);}});
    return()=>{controller.abort();preview.current?.pause();};
  },[broadcast,reload]);
  const changeScope=(value:boolean)=>{if(value===broadcast)return;setBusy(true);setError('');setMessage('');setSettings({revision:0,rules:[]});setBroadcast(value);};
  const update=(index:number,key:keyof NotificationRule,value:NotificationRule[keyof NotificationRule])=>setSettings(current=>({...current,rules:current.rules.map((x,i)=>i===index?{...x,[key]:value}:x)}));
  const save=async()=>{setBusy(true);setError('');try{setSettings(await notificationRequest<NotificationSettings>(`/settings?broadcast=${broadcast}`,{expectedRevision:settings.revision,rules:settings.rules},{method:'PUT'}));setMessage('通知設定已儲存。');}catch(e){setError((e instanceof Error?e.message:'操作失敗'));}finally{setBusy(false);}};
  const upload=async()=>{if(!file)return;setBusy(true);setError('');const body=new FormData();body.append('file',file);body.append('name',name);if(systemCode)body.append('systemCode',systemCode);try{const sound=await notificationRequest<NotificationSound>('/sounds',body);setSounds(current=>[...current,sound]);setFile(null);setMessage('音效已上傳。');}catch(e){setError((e instanceof Error?e.message:'操作失敗'));}finally{setBusy(false);}};
  return <AdminPage title="通知中心" eyebrow="Notifications" description="設定點餐與香檳塔提醒；關閉提示不代表接單或取消訂單。"><div className="adminTabs"><button disabled={busy} onClick={()=>changeScope(false)}>我的通知</button>{['manager','developer'].includes(user?.role||'')&&<button disabled={busy} onClick={()=>changeScope(true)}>店內廣播</button>}</div>
    {error&&<p className="adminNotice" role="alert">{error}</p>}{message&&<p className="adminNotice" role="status">{message}</p>}
    <AdminPanel title="本裝置"><p>{center?.state}</p><AdminButton onClick={center?.enableAudio}>{center?.enabled?'音效已啟用':'啟用音效'}</AdminButton><AdminButton onClick={center?.enableDesktop}>{center?.desktop?'桌面通知已允許':'允許桌面通知'}</AdminButton>{center?.audioError&&<p role="alert">{center.audioError}</p>}<p>離開後台或登出後停止提醒；首次載入不重播歷史通知。</p></AdminPanel>
    <AdminPanel title={broadcast?'店內廣播規則':'我的規則'} description={broadcast?'對象：所有有效後台帳號。啟用廣播必須選擇系統音效；香檳塔廣播音效優先於一般點餐廣播。':'預設不啟用任何個人通知。'}>
      {settings.rules.map((rule,index)=><div className="notification-rule" key={rule.id}><h3>{labels[rule.ruleType]}</h3><AdminToggle ariaLabel="啟用通知" label="啟用" checked={rule.isEnabled} onChange={(v:boolean)=>update(index,'isEnabled',v)}/>{!broadcast&&<AdminField label="顯示方式"><select value={rule.popupMode} onChange={e=>update(index,'popupMode',e.target.value)}><option value="none">不彈出（保留收件匣）</option><option value="toast">一般提示</option><option value="sticky">置頂提示</option></select></AdminField>}<AdminField label="音效"><select value={rule.soundId||''} onChange={e=>update(index,'soundId',e.target.value||null)}><option value="">無音效</option>{sounds.filter(x=>!broadcast||x.systemCode).map(sound=><option key={sound.id} value={sound.id}>{sound.name}</option>)}</select></AdminField><AdminButton onClick={()=>setSettings(current=>({...current,rules:current.rules.filter((_,i)=>i!==index)}))}>移除</AdminButton>{!broadcast&&index>0&&<AdminButton onClick={()=>setSettings(current=>{const rules=[...current.rules];[rules[index-1],rules[index]]=[rules[index],rules[index-1]];return {...current,rules};})}>上移（音效優先）</AdminButton>}</div>)}
      {Object.entries(labels).filter(([type])=>!settings.rules.some(x=>x.ruleType===type)).map(([type,label])=><AdminButton key={type} disabled={busy} onClick={()=>setSettings(current=>({...current,rules:[...current.rules,{id:crypto.randomUUID(),ruleType:type as NotificationRule['ruleType'],isEnabled:!broadcast,popupMode:broadcast?'banner':'toast',soundId:null}]}))}>＋{label}</AdminButton>)}<AdminButton disabled={busy} onClick={save}>儲存設定</AdminButton><AdminButton disabled={busy} onClick={()=>{setBusy(true);setError('');setReload(x=>x+1);}}>重新載入</AdminButton>
    </AdminPanel>
    <AdminPanel title="音效庫">{sounds.map(sound=><p key={sound.id}>{sound.name} · {sound.durationMs/1000} 秒 <button onClick={()=>{preview.current?.pause();preview.current=new Audio(notificationSoundUrl(sound.id));preview.current.play().catch(()=>setError('無法播放此音效。'));}}>試聽</button><button onClick={()=>preview.current?.pause()}>停止</button></p>)}{!caps?.soundUploadConfigured&&<p>音效解析器尚未配置，暫時無法上傳。</p>}<AdminField label="音效名稱"><input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></AdminField><AdminField label="音檔（Ogg/Opus 或 MP3，最多 5 秒／1 MiB）"><input type="file" accept=".ogg,.mp3" onChange={e=>setFile(e.target.files?.[0]||null)}/></AdminField>{user?.role==='developer'&&<AdminField label="系統音效代碼（留空為個人音效）" hint="基礎代碼：order_chime、time_reminder、store_broadcast；可增加其他代碼。"><input value={systemCode} pattern="[a-z][a-z0-9_]*" onChange={e=>setSystemCode(e.target.value)}/></AdminField>}<AdminButton disabled={busy||!file||!name.trim()||!caps?.soundUploadConfigured} onClick={upload}>上傳音效</AdminButton></AdminPanel>
  </AdminPage>;
}
