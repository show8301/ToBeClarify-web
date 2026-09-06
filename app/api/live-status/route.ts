import type { StaffReservation } from "@/features/site/types";
import type { StaffSummary } from "@/features/staff/types";
import { publicClientApiUrl } from "@/lib/server/upstream-config";

const STAFF_API_PATH="/staff-members";
const RESERVATION_API_PATH="/staff-reservations";
const ROOM_STATUS_API_PATH="/rooms/status";

export async function GET(request:Request){
  const url=new URL(request.url);
  const from=url.searchParams.get("from");
  const to=url.searchParams.get("to");
  if(!from||!to||Number.isNaN(Date.parse(from))||Number.isNaN(Date.parse(to)))return Response.json({error:"Valid from and to are required"},{status:400});

  const reservationUrl=new URL(publicClientApiUrl(RESERVATION_API_PATH));
  reservationUrl.searchParams.set("from",from);
  reservationUrl.searchParams.set("to",to);
  const roomStatusUrl=new URL(publicClientApiUrl(ROOM_STATUS_API_PATH));
  roomStatusUrl.searchParams.set("from",from);
  roomStatusUrl.searchParams.set("to",to);

  try{
    const options={cache:"no-store" as const,headers:{Accept:"application/json"},signal:AbortSignal.timeout(5000)};
    const [staffResponse,reservationResponse,roomResponse]=await Promise.all([
      fetch(publicClientApiUrl(STAFF_API_PATH),options),
      fetch(reservationUrl,options),
      fetch(roomStatusUrl,options).catch(()=>null),
    ]);
    if(!staffResponse.ok||!reservationResponse.ok)throw new Error("Live status upstream unavailable");
    const [staffPayload,reservationPayload,roomPayload]=await Promise.all([
      staffResponse.json() as Promise<{data?:StaffSummary[]}>,
      reservationResponse.json() as Promise<{data?:StaffReservation[]}>,
      roomResponse?.ok?roomResponse.json() as Promise<{data?:unknown[]}>:Promise.resolve({data:[]}),
    ]);
    if(!Array.isArray(staffPayload.data)||!Array.isArray(reservationPayload.data))throw new Error("Invalid live status response");
    return Response.json({staff:staffPayload.data,reservations:reservationPayload.data,rooms:Array.isArray(roomPayload.data)?roomPayload.data:[],syncedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return Response.json({error:"Unable to sync live status"},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
