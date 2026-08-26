import siteSnapshotJson from "./data/site-snapshot.json";
import staffSnapshotJson from "./data/staff-snapshot.json";
import type {
  GalleryAlbum,
  GalleryAlbumSummary,
  GuestbookPage,
  HomeData,
  HomePageVisibility,
  MenuData,
  RankingItem,
  SiteSnapshot,
} from "./lucid/site-types";
import type { StaffDetail, StaffSummary } from "./lucid/staff-types";

export const clientApiBase = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  "https://api.marchgroup.net/api/client"
).replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 8_000;

export class ClientApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
  }
}

type StaffSnapshot = {
  generatedAt: string;
  list: StaffSummary[];
  details: Record<string, StaffDetail>;
};

export const siteSnapshot = siteSnapshotJson as unknown as SiteSnapshot;
export const staffSnapshot = staffSnapshotJson as unknown as StaffSnapshot;

function timeoutSignal(external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!external) return timeout;
  return AbortSignal.any([external, timeout]);
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${clientApiBase}${path}`, {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: timeoutSignal(signal),
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; message?: string }
    | T
    | null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String(payload.message || `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    throw new ClientApiError(message, response.status);
  }
  if (payload && typeof payload === "object" && "success" in payload && payload.success === false) {
    throw new ClientApiError(String(payload.message || "API request failed"), response.status);
  }
  if (payload && typeof payload === "object" && "data" in payload) return payload.data as T;
  return payload as T;
}

function decodeSetting(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

type HomeResponse = {
  siteSettings?: { settingKey: string; settingValue: unknown }[];
  pageVisibility?: unknown;
  navigation?: HomeData["navigation"];
  shopRules?: HomeData["shopRules"];
  slides?: HomeData["slides"];
  carousels?: HomeData["carousels"];
};

const defaultPageVisibility: HomePageVisibility = {
  home: true,
  staff: true,
  gallery: true,
  menu: true,
  guestbook: true,
  liveUpdate: true,
  staffRanking: true,
  monetaryRanking: true,
};

function normalizePageVisibility(value: unknown, fallback = defaultPageVisibility): HomePageVisibility {
  if (!value || typeof value !== "object") return { ...fallback };
  const source = value as Record<string, unknown>;
  const legacyMenuHidden = source.menuHidden === true;
  return {
    home: source.home !== false,
    staff: source.staff !== false,
    gallery: source.gallery !== false,
    menu: typeof source.menu === "boolean" ? source.menu : !legacyMenuHidden,
    guestbook: source.guestbook !== false,
    liveUpdate: source.liveUpdate !== false,
    staffRanking: source.staffRanking !== false,
    monetaryRanking: source.monetaryRanking !== false,
  };
}

/** Converts the public /home response to the component-facing shape. */
export function normalizeHome(raw: HomeResponse, fallback: HomeData = siteSnapshot.home): HomeData {
  const settings = Object.fromEntries(
    (raw.siteSettings ?? []).map((item) => [item.settingKey, decodeSetting(item.settingValue)]),
  );
  const visibilitySetting = settings.siteVisibility && typeof settings.siteVisibility === "object"
    ? settings.siteVisibility
    : undefined;
  const pageVisibility = normalizePageVisibility(
    raw.pageVisibility ?? visibilitySetting,
    fallback.pageVisibility ?? defaultPageVisibility,
  );
  return {
    shopInfo: (settings.shopInfo as HomeData["shopInfo"] | undefined) ?? fallback.shopInfo,
    liveUpdateConfig:
      (settings.liveUpdateConfig as HomeData["liveUpdateConfig"] | undefined) ??
      fallback.liveUpdateConfig,
    pageVisibility,
    menuHidden: pageVisibility.menu === false,
    navigation: raw.navigation ?? fallback.navigation,
    shopRules: raw.shopRules ?? fallback.shopRules,
    slides: raw.slides ?? fallback.slides,
    carousels: raw.carousels ?? fallback.carousels,
  };
}

export async function loadHome(signal?: AbortSignal): Promise<HomeData> {
  return normalizeHome(await request<HomeResponse>("/home", signal));
}

export async function loadMenu(signal?: AbortSignal): Promise<MenuData> {
  return request<MenuData>("/menu", signal);
}

export async function loadStaff(signal?: AbortSignal): Promise<StaffSummary[]> {
  const result = await request<StaffSummary[]>("/staff-members", signal);
  if (!Array.isArray(result)) throw new Error("Invalid staff response");
  return result;
}

export async function loadStaffDetail(id: string, signal?: AbortSignal): Promise<StaffDetail> {
  return request<StaffDetail>(`/staff-members/${encodeURIComponent(id)}`, signal);
}

export async function loadGalleryAlbums(signal?: AbortSignal): Promise<GalleryAlbum[]> {
  const summaries = await request<GalleryAlbumSummary[]>("/gallery-albums", signal);
  const albums = await Promise.all(
    (summaries ?? []).map(async (summary) => {
      try {
        return await request<GalleryAlbum>(`/gallery-albums/${encodeURIComponent(summary.id)}`, signal);
      } catch {
        const cached = siteSnapshot.albumDetails[summary.id];
        return cached ?? ({ ...summary, details: [], items: [] } satisfies GalleryAlbum);
      }
    }),
  );
  return albums;
}

export async function loadGuestbook(signal?: AbortSignal): Promise<GuestbookPage> {
  return request<GuestbookPage>("/guestbook/comments?page=1&pageSize=20", signal);
}

export async function loadRankings(
  type: "staffRanking" | "monetaryRanking",
  signal?: AbortSignal,
): Promise<RankingItem[]> {
  return request<RankingItem[]>(`/rankings?type=${type}`, signal);
}

export function snapshotGalleryAlbums(): GalleryAlbum[] {
  return siteSnapshot.albums.map((summary) =>
    siteSnapshot.albumDetails[summary.id] ?? { ...summary, details: [], items: [] },
  );
}
