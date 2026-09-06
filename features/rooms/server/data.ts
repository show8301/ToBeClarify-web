import snapshotJson from "../../../data/snapshots/rooms.json";
import type { RoomsData, RoomStatus } from "../types";
import { publicClientApiUrl } from "@/lib/server/upstream-config";

const CACHE_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 3500;
const snapshot = snapshotJson as unknown as RoomsData;
let roomsCache: { value:RoomsData; expiresAt:number } = { value:snapshot, expiresAt:0 };
let roomsRefresh:Promise<void>|null = null;

async function request<T>(path:string):Promise<T>{
  const response=await fetch(publicClientApiUrl(path),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(REQUEST_TIMEOUT)});
  if(!response.ok)throw new Error(`${path} returned ${response.status}`);
  const payload=await response.json() as {success?:boolean;data?:T;message?:string};
  if(payload.success===false||payload.data===undefined)throw new Error(payload.message||`${path} failed`);
  return payload.data;
}

function refreshRooms(){
  if(roomsRefresh)return;
  roomsRefresh=request<RoomsData>("/rooms").then((value)=>{
    if(value?.rooms?.length)roomsCache={value,expiresAt:Date.now()+CACHE_TTL};
  }).catch(()=>{ roomsCache.expiresAt=Date.now()+CACHE_TTL; }).finally(()=>{ roomsRefresh=null; });
}

export function getRoomsData():RoomsData{
  if(Date.now()>=roomsCache.expiresAt)refreshRooms();
  return roomsCache.value;
}

export async function getRoomStatuses(from:string,to:string):Promise<RoomStatus[]>{
  try{
    return await request<RoomStatus[]>(`/rooms/status?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }catch{return []}
}
