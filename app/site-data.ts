import snapshotJson from "./data/site-snapshot.json";
import type { GalleryAlbum, GalleryAlbumSummary, GuestbookPage, HomeData, HomePageVisibility, MenuData, RankingItem, SiteSnapshot } from "./site-types";

const API="https://api.marchgroup.net/api/client";
const CACHE_TTL=10*60*1000;
const REQUEST_TIMEOUT=3500;
const snapshot=snapshotJson as unknown as SiteSnapshot;

type CacheEntry<T>={value:T;expiresAt:number;refresh:Promise<void>|null};
const homeCache:CacheEntry<HomeData>={value:snapshot.home,expiresAt:0,refresh:null};
const menuCache:CacheEntry<MenuData>={value:snapshot.menu,expiresAt:0,refresh:null};
const albumsCache:CacheEntry<GalleryAlbumSummary[]>={value:snapshot.albums,expiresAt:0,refresh:null};
const staffRankingCache:CacheEntry<RankingItem[]>={value:snapshot.staffRanking,expiresAt:0,refresh:null};
const monetaryRankingCache:CacheEntry<RankingItem[]>={value:snapshot.monetaryRanking,expiresAt:0,refresh:null};
const guestbookCache:CacheEntry<GuestbookPage>={value:snapshot.guestbook,expiresAt:0,refresh:null};
const albumCaches=new Map(Object.entries(snapshot.albumDetails).map(([id,value])=>[id,{value,expiresAt:0,refresh:null} satisfies CacheEntry<GalleryAlbum>]));

async function request<T>(path:string):Promise<T>{
  const response=await fetch(`${API}${path}`,{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(REQUEST_TIMEOUT)});
  if(!response.ok)throw new Error(`${path} returned ${response.status}`);
  const payload=await response.json() as {success:boolean;data:T;message?:string};
  if(!payload.success)throw new Error(payload.message||`${path} failed`);
  return payload.data;
}

function useCache<T>(entry:CacheEntry<T>,loader:()=>Promise<T>):T{
  if(Date.now()>=entry.expiresAt&&!entry.refresh){
    entry.refresh=loader().then((value)=>{entry.value=value}).catch(()=>{}).finally(()=>{
      entry.expiresAt=Date.now()+CACHE_TTL;
      entry.refresh=null;
    });
  }
  return entry.value;
}

const defaultPageVisibility:HomePageVisibility={home:true,staff:true,gallery:true,menu:true,guestbook:true,liveUpdate:true,staffRanking:true,monetaryRanking:true};

function normalizePageVisibility(value:unknown):HomePageVisibility{
  if(!value||typeof value!=="object")return defaultPageVisibility;
  const source=value as Record<string,unknown>;
  const legacyMenuHidden=source.menuHidden===true;
  return{
    home:source.home!==false,
    staff:source.staff!==false,
    gallery:source.gallery!==false,
    menu:typeof source.menu==="boolean"?source.menu:!legacyMenuHidden,
    guestbook:source.guestbook!==false,
    liveUpdate:source.liveUpdate!==false,
    staffRanking:source.staffRanking!==false,
    monetaryRanking:source.monetaryRanking!==false,
  };
}

function normalizeHome(raw:{siteSettings:{settingKey:string;settingValue:unknown}[];pageVisibility?:unknown;navigation:HomeData["navigation"];shopRules:HomeData["shopRules"];slides:HomeData["slides"];carousels:HomeData["carousels"]}):HomeData{
  const settings=Object.fromEntries(raw.siteSettings.map((item)=>[item.settingKey,item.settingValue]));
  const siteVisibility=settings.siteVisibility && typeof settings.siteVisibility === "object" ? settings.siteVisibility as {menuHidden?:unknown} : {};
  const pageVisibility=normalizePageVisibility(raw.pageVisibility??siteVisibility);
  return{shopInfo:settings.shopInfo as HomeData["shopInfo"],liveUpdateConfig:settings.liveUpdateConfig as HomeData["liveUpdateConfig"],pageVisibility,menuHidden:pageVisibility.menu===false,navigation:raw.navigation??[],shopRules:raw.shopRules??[],slides:raw.slides??[],carousels:raw.carousels??[]};
}

export function getSiteHome():HomeData{
  return useCache(homeCache,()=>request<Parameters<typeof normalizeHome>[0]>("/home").then(normalizeHome));
}
export function getMenuData():MenuData{return useCache(menuCache,()=>request<MenuData>("/menu"))}
export function getGalleryAlbums():GalleryAlbumSummary[]{return useCache(albumsCache,()=>request<GalleryAlbumSummary[]>("/gallery-albums"))}
export function getGalleryAlbum(id:string):GalleryAlbum|null{
  const entry=albumCaches.get(id);
  if(!entry)return null;
  return useCache(entry,()=>request<GalleryAlbum>(`/gallery-albums/${encodeURIComponent(id)}`));
}
export function getRankings(type:"staffRanking"|"monetaryRanking"):RankingItem[]{
  const entry=type==="staffRanking"?staffRankingCache:monetaryRankingCache;
  return useCache(entry,()=>request<RankingItem[]>(`/rankings?type=${type}`));
}
export function getGuestbookComments():GuestbookPage{return useCache(guestbookCache,()=>request<GuestbookPage>("/guestbook/comments"))}
export const siteSnapshotGeneratedAt=snapshot.generatedAt;
