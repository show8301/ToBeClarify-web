import type { GuestbookPage } from "@/features/site/types";
import { publicClientApiUrl } from "@/lib/server/upstream-config";

const GUESTBOOK_API_PATH="/guestbook/comments";

export async function GET(request:Request){
  const url=new URL(request.url);
  const page=Math.max(1,Number(url.searchParams.get("page"))||1);
  const upstream=new URL(publicClientApiUrl(GUESTBOOK_API_PATH));
  upstream.searchParams.set("page",String(page));
  try{
    const response=await fetch(upstream,{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(3500)});
    if(!response.ok)throw new Error(`Guestbook returned ${response.status}`);
    const payload=await response.json() as {success:boolean;data:GuestbookPage};
    return Response.json(payload.data,{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}});
  }catch{return Response.json({items:[],page,pageSize:20,totalCount:0} satisfies GuestbookPage,{status:502})}
}

export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as {displayName?:string;content?:string;userToken?:string}|null;
  if(!body?.displayName?.trim()||!body.content?.trim()||!body.userToken?.trim())return Response.json({error:"請完整填寫暱稱、留言與識別碼"},{status:400});
  const response=await fetch(publicClientApiUrl(GUESTBOOK_API_PATH),{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({displayName:body.displayName.trim(),content:body.content.trim(),userToken:body.userToken}),signal:AbortSignal.timeout(5000)});
  const payload=await response.json().catch(()=>({message:"留言服務暫時無法使用"})) as {success?:boolean;data?:unknown;message?:string};
  if(!response.ok||payload.success===false)return Response.json({error:payload.message||"留言送出失敗"},{status:response.status||502});
  return Response.json(payload.data??payload,{status:201});
}
