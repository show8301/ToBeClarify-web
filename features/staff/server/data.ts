import snapshotJson from "../../../data/snapshots/staff.json";
import type { StaffDetail, StaffSummary } from "../types";

const API = "https://api.marchgroup.net/api/client/staff-members";
const CACHE_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 3500;

type Snapshot = { generatedAt:string; list:StaffSummary[]; details:Record<string,StaffDetail> };
type CacheEntry<T> = { value:T; expiresAt:number };

class StaffApiError extends Error {
  status:number;

  constructor(status:number) {
    super(`Staff API returned ${status}`);
    this.name = "StaffApiError";
    this.status = status;
  }
}

const snapshot = snapshotJson as unknown as Snapshot;
let listCache:CacheEntry<StaffSummary[]> = { value:snapshot.list, expiresAt:0 };
let listRefresh:Promise<void>|null = null;
const detailCache = new Map<string,CacheEntry<StaffDetail>>();
const detailRefresh = new Map<string,Promise<StaffDetail|null>>();

async function request<T>(url:string):Promise<T> {
  const response = await fetch(url, {
    cache:"no-store",
    headers:{ Accept:"application/json" },
    signal:AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new StaffApiError(response.status);
  return response.json() as Promise<T>;
}

function refreshList() {
  if (listRefresh) return;
  listRefresh = request<{data:StaffSummary[]}>(API)
    .then(({data}) => { if (data?.length) listCache = { value:data, expiresAt:Date.now()+CACHE_TTL }; })
    .catch(() => { listCache.expiresAt = Date.now()+CACHE_TTL; })
    .finally(() => { listRefresh = null; });
}

export function getStaffList():StaffSummary[] {
  if (Date.now() >= listCache.expiresAt) refreshList();
  return listCache.value;
}

export async function getStaffDetail(id:string):Promise<StaffDetail|null> {
  const cached = detailCache.get(id);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const pending = detailRefresh.get(id);
  if (pending) return pending;

  const fallback = cached?.value ?? snapshot.details[id] ?? null;
  const refresh = (async()=>{
    try {
      const { data } = await request<{data:StaffDetail|null}>(`${API}/${encodeURIComponent(id)}`);
      if (!data) return fallback;
      detailCache.set(id,{ value:data, expiresAt:Date.now()+CACHE_TTL });
      return data;
    } catch (error) {
      if (error instanceof StaffApiError && error.status === 404) {
        detailCache.delete(id);
        return null;
      }
      if (fallback) {
        detailCache.set(id,{ value:fallback, expiresAt:Date.now()+CACHE_TTL });
        return fallback;
      }
      throw error;
    }
  })()
    .finally(()=>detailRefresh.delete(id));
  detailRefresh.set(id,refresh);
  return refresh;
}

export const staffSnapshotGeneratedAt = snapshot.generatedAt;
