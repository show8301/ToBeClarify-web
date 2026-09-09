export const notificationSoundUrl=(id:string)=>`/api/admin/notifications/sounds/${encodeURIComponent(id)}/content`;
export class NotificationApiError extends Error{constructor(message:string,public status=0){super(message);}}
export async function notificationRequest<T>(path='',body?:unknown,options:RequestInit={}):Promise<T>{
  const form=body instanceof FormData;
  let response:Response;
  try{response=await fetch(`/api/admin/notifications${path}`,{credentials:'include',cache:'no-store',method:body===undefined?'GET':'POST',...options,headers:{Accept:'application/json',...(body&&!form?{'Content-Type':'application/json'}:{}),...options.headers},...(body===undefined?{}:{body:form?body:JSON.stringify(body)})});}
  catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw error;throw new NotificationApiError('通知服務連線中斷。');}
  const payload=await response.json().catch(()=>null) as {success?:boolean;message?:string;data:T}|null;
  if(!response.ok||payload?.success===false||!payload)throw new NotificationApiError(payload?.message||`通知服務暫時無法使用（${response.status}）`,response.status);
  return payload.data;
}
