import {AdminField,AdminToggle} from '@/features/admin/shared/AdminShared.jsx';
import type {PricingPolicy,ProductPolicy} from '@/features/site/types';
const pricingPolicy:PricingPolicy={mode:'information',source:null,showOnHome:false,showOnMenu:true,showOnOrder:true};
const productPolicy:ProductPolicy={canOrderAlone:true,eventCategories:[]};
type PricingProps={form:{policy?:PricingPolicy};update:(key:string,value:PricingPolicy)=>void};
type ProductProps={form:{policy?:ProductPolicy};update:(key:string,value:ProductPolicy)=>void;single?:boolean};
export function PricingPolicyForm({form,update}:PricingProps) {
  const policy={...pricingPolicy,...form.policy};
  const set=(key:keyof PricingPolicy,value:PricingPolicy[keyof PricingPolicy])=>update('policy',{...policy,[key]:value});
  return <><AdminField label="規則模式"><select value={policy.mode} onChange={e=>update('policy',{...policy,mode:e.target.value as PricingPolicy['mode'],source:e.target.value==='system'?'minimum_meal_credit':null})}><option value="information">僅說明</option><option value="system">連結系統收費設定</option></select></AdminField>
    {policy.mode==='system'&&<AdminField label="系統來源" hint="金額由點餐設定提供，既有入場信物額度不追溯變更。"><select value={policy.source||'minimum_meal_credit'} onChange={e=>set('source',e.target.value)}><option value="minimum_meal_credit">入場餐點信物</option><option value="base_nomination_fee">每節指名基礎費</option></select></AdminField>}
    <div className="adminFormWide">{([['showOnHome','首頁摘要'],['showOnMenu','公開菜單'],['showOnOrder','點餐確認']] as const).map(([key,label])=><AdminToggle ariaLabel={label} key={key} label={label} checked={policy[key]} onChange={(value:boolean)=>set(key,value)}/>)}</div>
    {(['validFrom','validUntil'] as const).map(key=><AdminField key={key} label={key==='validFrom'?'生效時間（台北）':'結束時間（台北）'}><input type="datetime-local" value={policy[key]?new Date(new Date(policy[key]).getTime()+8*3600000).toISOString().slice(0,16):''} onChange={e=>set(key,e.target.value?`${e.target.value}:00+08:00`:null)}/></AdminField>)}</>;
}

export function ProductPolicyForm({form,update,single=false}:ProductProps) {
  const policy={...productPolicy,...form.policy};
  return <div className="adminFormWide"><strong>供應與事件分類</strong>{single&&<AdminToggle ariaLabel="可單點" label="可單點（關閉後仍可作為套餐內容）" checked={policy.canOrderAlone} onChange={(value:boolean)=>update('policy',{...policy,canOrderAlone:value})}/>}
    <AdminToggle ariaLabel="香檳塔事件" label="香檳塔事件" checked={policy.eventCategories.includes('champagne_tower')} onChange={(value:boolean)=>update('policy',{...policy,eventCategories:value?['champagne_tower']:[]})}/>
    <p className="adminFieldHint">事件分類供通知中心使用；不會改變價格、信物折抵或接單方式。套餐會繼承內容品項的分類。</p></div>;
}
