import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminRouter } from "./admin/AdminRouter.jsx";
import GalleryArchive from "./lucid/GalleryArchive";
import GuestbookWall from "./lucid/GuestbookWall";
import HallOfHonor from "./lucid/HallOfHonor";
import HomeLanding from "./lucid/HomeLanding";
import LiveUpdateBoard from "./lucid/LiveUpdateBoard";
import MenuCatalog from "./lucid/MenuCatalog";
import SiteChrome from "./lucid/SiteChrome";
import StaffArchive from "./lucid/StaffArchive";
import StaffProfile from "./lucid/StaffProfile";
import type { GalleryAlbum, GuestbookPage, HomeData, MenuData, RankingItem } from "./lucid/site-types";
import type { StaffDetail, StaffSummary } from "./lucid/staff-types";
import {
  loadGalleryAlbums,
  loadGuestbook,
  loadHome,
  loadMenu,
  loadRankings,
  loadStaff,
  loadStaffDetail,
  ClientApiError,
  siteSnapshot,
  snapshotGalleryAlbums,
  staffSnapshot,
} from "./lucid-api";

const NAVIGATION_EVENT = "lucid:navigation";

function currentPath(): string {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path || "/";
}

function useBrowserPath() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATION_EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATION_EVENT, update);
    };
  }, []);
  return path;
}

export function navigateTo(href: string, options: { replace?: boolean } = {}) {
  const target = new URL(href, window.location.href);
  const next = `${target.pathname}${target.search}${target.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  window.history[options.replace ? "replaceState" : "pushState"]({}, "", next);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function useRemoteValue<T>(initial: T, loader: (signal: AbortSignal) => Promise<T>, key = "") {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void loader(controller.signal)
      .then(setValue)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setError(error);
      });
    return () => controller.abort();
    // A route identifier deliberately restarts this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { value, failed: error !== null, error };
}

function SitePage({ home, children }: { home: HomeData; children: React.ReactNode }) {
  return <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo}>{children}</SiteChrome>;
}

function StaffPage({ home }: { home: HomeData }) {
  const { value } = useRemoteValue(staffSnapshot.list, loadStaff);
  return <SitePage home={home}><StaffArchive initialStaff={value} embedded /></SitePage>;
}

function StaffDetailPage({ id }: { id: string }) {
  const { value: staff, failed, error } = useRemoteValue<StaffDetail | null>(
    null,
    (signal) => loadStaffDetail(id, signal),
    id,
  );
  const { value: list } = useRemoteValue(staffSnapshot.list, loadStaff);

  if (!staff) {
    const title = error instanceof ClientApiError && error.status === 404
      ? "找不到店員資料"
      : failed ? "暫時無法讀取店員資料" : "正在開啟店員檔案…";
    return <RouteMessage title={title} />;
  }
  const index = Math.max(0, list.findIndex((person) => person.id === staff.id));
  const previous = list.length > 1 ? list[(index - 1 + list.length) % list.length] : null;
  const next = list.length > 1 ? list[(index + 1) % list.length] : null;
  return <StaffProfile staff={staff} index={index} navigation={{ previous, next, total: list.length, list }} />;
}

function GalleryPage({ home, initialAlbumId }: { home: HomeData; initialAlbumId?: string | null }) {
  const { value } = useRemoteValue<GalleryAlbum[]>(snapshotGalleryAlbums(), loadGalleryAlbums);
  return <SitePage home={home}><GalleryArchive albums={value} initialAlbumId={initialAlbumId} /></SitePage>;
}

function MenuPage({ home }: { home: HomeData }) {
  const { value } = useRemoteValue<MenuData>(siteSnapshot.menu, loadMenu);
  return <SitePage home={home}><MenuCatalog menu={value} /></SitePage>;
}

function GuestbookPage({ home }: { home: HomeData }) {
  const { value } = useRemoteValue<GuestbookPage>(siteSnapshot.guestbook, loadGuestbook);
  const revision = `${value.page}:${value.totalCount}:${value.items[0]?.id ?? "empty"}`;
  return <SitePage home={home}><GuestbookWall key={revision} initial={value} /></SitePage>;
}

function LivePage({ home }: { home: HomeData }) {
  const { value } = useRemoteValue<StaffSummary[]>(staffSnapshot.list, loadStaff);
  return <SitePage home={home}><LiveUpdateBoard staff={value} config={home.liveUpdateConfig} /></SitePage>;
}

function RankingPage({ home, type }: { home: HomeData; type: "staffRanking" | "monetaryRanking" }) {
  const initial = type === "staffRanking" ? siteSnapshot.staffRanking : siteSnapshot.monetaryRanking;
  const { value } = useRemoteValue<RankingItem[]>(initial, (signal) => loadRankings(type, signal), type);
  return <SitePage home={home}><HallOfHonor items={value} variant={type === "staffRanking" ? "staff" : "monetary"} /></SitePage>;
}

function RouteMessage({ title }: { title: string }) {
  return <main className="site-route-message" role="status"><span>LUCID DREAM</span><h1>{title}</h1><a href="/">回到首頁</a></main>;
}

export default function LucidApp() {
  const path = useBrowserPath();
  const { value: home } = useRemoteValue<HomeData>(siteSnapshot.home, loadHome);
  const navigate = useCallback((href: string) => navigateTo(href), []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.download || anchor.origin !== window.location.origin) return;
      event.preventDefault();
      navigateTo(anchor.href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const route = useMemo(() => {
    if (path.startsWith("/admin")) return <AdminRouter route={path} navigate={navigate} />;
    if (path === "/" || path === "/home") return <SitePage home={home}><HomeLanding home={home} /></SitePage>;
    if (path === "/staff") return <StaffPage home={home} />;
    const staffMatch = path.match(/^\/staff\/([^/]+)$/);
    if (staffMatch) return <StaffDetailPage key={staffMatch[1]} id={decodeURIComponent(staffMatch[1])} />;
    if (path === "/gallery" || path === "/event") return <GalleryPage home={home} />;
    const galleryMatch = path.match(/^\/gallery\/([^/]+)$/);
    if (galleryMatch) return <GalleryPage key={galleryMatch[1]} home={home} initialAlbumId={decodeURIComponent(galleryMatch[1])} />;
    if (path === "/menu") return <MenuPage home={home} />;
    if (path === "/guestbook") return <GuestbookPage home={home} />;
    if (path === "/liveupdate") return <LivePage home={home} />;
    if (path === "/staffRanking") return <RankingPage key="staffRanking" home={home} type="staffRanking" />;
    if (path === "/monetaryRanking") return <RankingPage key="monetaryRanking" home={home} type="monetaryRanking" />;
    return <RouteMessage title="這場夢境不存在" />;
  }, [home, navigate, path]);

  return route;
}
