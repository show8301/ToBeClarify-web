"use client";
import {useEffect,useState} from 'react';

export type OrderQuote = {
  quoteToken:string;expiresAt:string;subtotal:number;mealCreditApplied:number;remainingMealCredit:number;totalAmount:number;
  requiresStoreConfirmation:boolean;
  charges:{name:string;quantity:number;lineTotal:number}[];
  lines:{referenceId:string;name:string;quantity:number;components:{menuItemId:string;itemName:string;quantity:number}[]}[];
  rules:{id:string;title:string;description:string;priceText:string|null}[];
};
const money=(value:number)=>`${value.toLocaleString('zh-TW')} Gil`;
export function OrderQuoteReview({quote,loading,onConfirm,onRefresh}:{quote:OrderQuote;loading:boolean;onConfirm:()=>void;onRefresh:()=>void}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const expired=now>=new Date(quote.expiresAt).getTime();
  return <section id="order-quote-review" className="orderQuoteReview" aria-label="正式報價確認"><h2>確認本次金額與消費規則</h2>
    {quote.rules.map(rule=><article key={rule.id}><h3>{rule.title}</h3><p>{rule.description}</p><strong>{rule.priceText}</strong></article>)}
    <dl>{quote.charges.map((line,index)=><div key={index}><dt>{line.name} × {line.quantity}</dt><dd>{money(line.lineTotal)}</dd></div>)}</dl>
    {quote.lines.filter(line=>line.components.length>0).map((line,index)=><details key={`${line.referenceId}:${index}`} open><summary>{line.name} × {line.quantity} 的完整內容</summary><ul>{line.components.map((item,i)=><li key={`${item.menuItemId}:${i}`}>{item.itemName} × {item.quantity}</li>)}</ul></details>)}
    <dl><div><dt>商品小計</dt><dd>{money(quote.subtotal)}</dd></div><div><dt>餐點信物折抵</dt><dd>−{money(quote.mealCreditApplied)}</dd></div><div><dt>折抵後信物餘額</dt><dd>{money(quote.remainingMealCredit)}</dd></div><div><dt>本次應付</dt><dd>{money(quote.totalAmount)}</dd></div></dl>
    {quote.requiresStoreConfirmation&&<p>本單提交後需要店內確認。</p>}
    <p role="status">{expired?'報價已到期，請重新取得報價。':`有效至 ${new Date(quote.expiresAt).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'})}；價格或供應狀態變更時須重新確認。`}</p>
    <button type="button" disabled={loading||expired} onClick={onConfirm}>確認金額並送出</button><button type="button" disabled={loading} onClick={onRefresh}>返回修改／重新報價</button>
  </section>;
}
