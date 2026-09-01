import type { StaffReservation } from "@/features/site/types";
import type { StaffSummary } from "@/features/staff/types";
import { publicClientApiUrl } from "@/lib/server/upstream-config";

const STAFF_API_PATH="/staff-members";
const RESERVATION_API_PATH="/staff-reservations";

export async function GET(request:Request){
  const url=new URL(request.url);
  const from=url.searchParams.get("from");
  const to=url.searchParams.get("to");
  if(!from||!to||Number.isNaN(Date.parse(from))||Number.isNaN(Date.parse(to)))return Response.json({error:"Valid from and to are required"},{status:400});

  const reservationUrl=new URL(publicClientApiUrl(RESERVATION_API_PATH));
  reservationUrl.searchParams.set("from",from);
  reservationUrl.searchParams.set("to",to);

  try{
    const options={cache:"no-store" as const,headers:{Accept:"application/json"},signal:AbortSignal.timeout(5000)};
    const [staffResponse,reservationResponse]=await Promise.all([fetch(publicClientApiUrl(STAFF_API_PATH),options),fetch(reservationUrl,options)]);
    if(!staffResponse.ok||!reservationResponse.ok)throw new Error("Live status upstream unavailable");
    const [staffPayload,reservationPayload]=await Promise.all([
      staffResponse.json() as Promise<{data?:StaffSummary[]}>,
      reservationResponse.json() as Promise<{data?:StaffReservation[]}>,
    ]);
    if(!Array.isArray(staffPayload.data)||!Array.isArray(reservationPayload.data))throw new Error("Invalid live status response");
    return Response.json({staff:staffPayload.data,reservations:reservationPayload.data,syncedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return Response.json({error:"Unable to sync live status"},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
