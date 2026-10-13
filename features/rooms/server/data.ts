import type { RoomsData, RoomStatus } from "../types";
import { publicClientApiUrl } from "../../../lib/server/upstream-config.ts";

const CACHE_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 3500;
const RETRY_DELAY = 30 * 1000;
// Only successfully loaded API data may be used as a stale fallback.
let roomsCache: { value:RoomsData|null; expiresAt:number } = { value:null, expiresAt:0 };
let roomsRefresh:Promise<void>|null = null;

async function request<T>(path:string):Promise<T>{
  const response=await fetch(publicClientApiUrl(path),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(REQUEST_TIMEOUT)});
  if(!response.ok)throw new Error(`${path} returned ${response.status}`);
  const payload=await response.json() as {success?:boolean;data?:T;message?:string};
  if(payload.success===false||payload.data===undefined)throw new Error(payload.message||`${path} failed`);
  return payload.data;
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object";
}

function isRoomsData(value:unknown):value is RoomsData{
  if(!isRecord(value)||typeof value.segmentMinutes!=="number"||!Number.isFinite(value.segmentMinutes)||value.segmentMinutes<=0||!Array.isArray(value.rooms))return false;
  return value.rooms.every((room:unknown)=>
    isRecord(room)&&typeof room.id==="string"&&typeof room.roomName==="string"&&
    typeof room.shortDescription==="string"&&(room.detailContent===null||typeof room.detailContent==="string")&&
    typeof room.ownershipType==="string"&&(room.ownerStaffId===null||typeof room.ownerStaffId==="string")&&
    (room.ownerStaffName===null||typeof room.ownerStaffName==="string")&&
    typeof room.segmentMinutes==="number"&&Number.isFinite(room.segmentMinutes)&&room.segmentMinutes>0&&
    typeof room.segmentPrice==="number"&&Number.isFinite(room.segmentPrice)&&
    Array.isArray(room.photos)&&room.photos.every((photo:unknown)=>
      isRecord(photo)&&typeof photo.id==="string"&&typeof photo.imageUrl==="string"&&
      (photo.mediaId===null||typeof photo.mediaId==="string")&&typeof photo.sortOrder==="number"&&Number.isFinite(photo.sortOrder)));
}

function refreshRooms(){
  if(roomsRefresh)return;
  roomsRefresh=request<unknown>("/rooms").then((value)=>{
    if(!isRoomsData(value))throw new Error("Invalid rooms response");
    roomsCache={value,expiresAt:Date.now()+CACHE_TTL};
  }).catch((error:unknown)=>{
    roomsCache.expiresAt=Date.now()+RETRY_DELAY;
    console.warn("[rooms] Public catalog refresh failed; retrying in 30 seconds.",error instanceof Error?error.message:"Unknown error");
  }).finally(()=>{ roomsRefresh=null; });
}

export async function getRoomsData():Promise<RoomsData|null>{
  if(Date.now()>=roomsCache.expiresAt)refreshRooms();
  // Wait for the bounded request so a cold process cannot render demo data.
  if(roomsRefresh)await roomsRefresh;
  return roomsCache.value;
}

// The live board can still show staff when no room catalog is available.
export async function getRoomsDataForLivePage():Promise<RoomsData>{
  return await getRoomsData()??{segmentMinutes:20,rooms:[]};
}

export async function getRoomStatuses(from:string,to:string):Promise<RoomStatus[]>{
  try{
    return await request<RoomStatus[]>(`/rooms/status?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }catch{return []}
}
