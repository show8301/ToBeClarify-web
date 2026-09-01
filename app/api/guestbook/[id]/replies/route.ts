import { publicClientApiUrl } from "@/lib/server/upstream-config";

const GUESTBOOK_API_PATH="/guestbook/comments";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const body=await request.json().catch(()=>null) as {displayName?:string;content?:string;userToken?:string}|null;
  if(!body?.displayName?.trim()||!body.content?.trim()||!body.userToken?.trim())return Response.json({error:"請完整填寫暱稱、回覆與識別碼"},{status:400});
  const response=await fetch(publicClientApiUrl(`${GUESTBOOK_API_PATH}/${encodeURIComponent(id)}/replies`),{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({displayName:body.displayName.trim(),content:body.content.trim(),userToken:body.userToken}),signal:AbortSignal.timeout(5000)});
  const payload=await response.json().catch(()=>({message:"回覆服務暫時無法使用"})) as {success?:boolean;data?:unknown;message?:string};
  if(!response.ok||payload.success===false)return Response.json({error:payload.message||"回覆送出失敗"},{status:response.status||502});
  return Response.json(payload.data??payload,{status:201});
}
