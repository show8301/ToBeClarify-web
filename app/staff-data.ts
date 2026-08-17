import snapshotJson from "./data/staff-snapshot.json";
import type { StaffDetail, StaffSummary } from "./staff-types";

const API = "https://api.marchgroup.net/api/client/staff-members";
const CACHE_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 3500;

type Snapshot = { generatedAt:string; list:StaffSummary[]; details:Record<string,StaffDetail> };
type CacheEntry<T> = { value:T; expiresAt:number };

const snapshot = snapshotJson as unknown as Snapshot;
let listCache:CacheEntry<StaffSummary[]> = { value:snapshot.list, expiresAt:0 };
let listRefresh:Promise<void>|null = null;
const detailCache = new Map<string,CacheEntry<StaffDetail>>();
const detailRefresh = new Map<string,Promise<void>>();

async function request<T>(url:string):Promise<T> {
  const response = await fetch(url, {
    cache:"no-store",
    headers:{ Accept:"application/json" },
    signal:AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`Staff API returned ${response.status}`);
  return response.json() as Promise<T>;
}

function refreshList() {
  if (listRefresh) return;
  listRefresh = request<{data:StaffSummary[]}>(API)
    .then(({data}) => { if (data?.length) listCache = { value:data, expiresAt:Date.now()+CACHE_TTL }; })
    .catch(() => { listCache.expiresAt = Date.now()+CACHE_TTL; })
    .finally(() => { listRefresh = null; });
}

function refreshDetail(id:string) {
  if (detailRefresh.has(id)) return;
  const refresh = request<{data:StaffDetail}>(`${API}/${id}`)
    .then(({data}) => { if (data) detailCache.set(id,{ value:data, expiresAt:Date.now()+CACHE_TTL }); })
    .catch(() => {
      const fallback = detailCache.get(id);
      if (fallback) detailCache.set(id,{ ...fallback, expiresAt:Date.now()+CACHE_TTL });
    })
    .finally(() => { detailRefresh.delete(id); });
  detailRefresh.set(id,refresh);
}

export function getStaffList():StaffSummary[] {
  if (Date.now() >= listCache.expiresAt) refreshList();
  return listCache.value;
}

export function getStaffDetail(id:string):StaffDetail|null {
  let cached = detailCache.get(id);
  if (!cached) {
    const fallback = snapshot.details[id];
    if (!fallback) return null;
    cached = { value:fallback, expiresAt:0 };
    detailCache.set(id,cached);
  }
  if (Date.now() >= cached.expiresAt) refreshDetail(id);
  return cached.value;
}

export const staffSnapshotGeneratedAt = snapshot.generatedAt;
