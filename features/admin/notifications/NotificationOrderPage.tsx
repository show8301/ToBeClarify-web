"use client";
import {useEffect,useState} from 'react';
import {useAdminAuth} from '@/features/admin/auth/AdminAuthContext.jsx';

type OrderLookup={session:{id:string;customerName:string;businessDate:string};order:{
  orderNumber:string;status:string;storeConfirmationStatus:string;totalAmount:number;
  items:{id:string;name:string;quantity:number;lineTotal:number}[];
  menuSnapshot?:{lines:{referenceId:string;name:string;quantity:number;components:{menuItemId:string;itemName:string;quantity:number}[]}[]};
}};
export function NotificationOrderPage({orderId}:{orderId:string}){
  const {user}=useAdminAuth();
  const [result,setResult]=useState<OrderLookup|null>(null),[error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`,{credentials:'include',cache:'no-store',signal:controller.signal})
      .then(async response=>{const payload=await response.json();if(!response.ok||!payload.success)throw new Error(payload.message||'無法讀取訂單');return payload.data as OrderLookup;})
      .then(data=>{if(!controller.signal.aborted)setResult(data);})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'無法讀取訂單');});
    return()=>controller.abort();
  },[orderId,attempt]);
  return <section className="adminPage"><h1>通知訂單明細</h1><button onClick={()=>{setResult(null);setError('');setAttempt(x=>x+1);}}>重新整理</button>
    {error?<p role="alert">{error}</p>:!result?<p role="status">讀取中…</p>:<>
      <h2>{result.order.orderNumber} · {result.session.customerName}</h2>
      <p>目前狀態：{({pending:'等待確認',confirmed:'已成立',preparing:'準備中',serving:'服務中',completed:'已完成',cancelled:'已取消',expired:'已過期'} as Record<string,string>)[result.order.status]||result.order.status}{result.order.storeConfirmationStatus==='pending'?' · 待店內確認':''}</p>
      <ul>{result.order.items.map(item=><li key={item.id}>{item.name} × {item.quantity} · {item.lineTotal.toLocaleString('zh-TW')} Gil</li>)}</ul>
      <p>目前應付：{result.order.totalAmount.toLocaleString('zh-TW')} Gil</p>
      {result.order.menuSnapshot&&<details><summary>提交當時套餐內容（歷史快照）</summary>{result.order.menuSnapshot.lines.filter(line=>line.components.length>0).map((line,index)=><div key={`${line.referenceId}:${index}`}><h3>{line.name} × {line.quantity}</h3><ul>{line.components.map((part,i)=><li key={`${part.menuItemId}:${i}`}>{part.itemName} × {part.quantity}</li>)}</ul></div>)}</details>}
      <p>查看通知不會變更訂單狀態。</p>
      {user?.role==='developer'&&<a href={`/admin/orders?session=${encodeURIComponent(result.session.id)}&date=${result.session.businessDate}`}>前往完整點單管理</a>}
    </>}
  </section>;
}
