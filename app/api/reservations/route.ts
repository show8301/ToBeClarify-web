import type { StaffReservation } from "../../site-types";

const API="https://api.marchgroup.net/api/client/staff-reservations";

export async function GET(request:Request){
  const url=new URL(request.url);
  const from=url.searchParams.get("from");
  const to=url.searchParams.get("to");
  if(!from||!to||Number.isNaN(Date.parse(from))||Number.isNaN(Date.parse(to)))return Response.json({error:"Valid from and to are required"},{status:400});
  try{
    const upstream=new URL(API);
    upstream.searchParams.set("from",from);
    upstream.searchParams.set("to",to);
    const response=await fetch(upstream,{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(3500)});
    if(!response.ok)throw new Error(`Reservations returned ${response.status}`);
    const payload=await response.json() as {success:boolean;data:StaffReservation[]};
    return Response.json(payload.data??[],{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}});
  }catch{return Response.json([],{headers:{"Cache-Control":"public, max-age=30"}})}
}
