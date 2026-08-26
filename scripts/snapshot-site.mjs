import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API = "https://api.marchgroup.net/api/client";
const output = fileURLToPath(new URL("../app/data/site-snapshot.json", import.meta.url));

async function get(path) {
  const response = await fetch(`${API}${path}`, { headers:{ Accept:"application/json" } });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.message || `${path} failed`);
  return payload.data;
}

const [rawHome, menu, albums, staffRanking, monetaryRanking, guestbook] = await Promise.all([
  get("/home"),
  get("/menu"),
  get("/gallery-albums"),
  get("/rankings?type=staffRanking"),
  get("/rankings?type=monetaryRanking"),
  get("/guestbook/comments"),
]);

const settings = Object.fromEntries(rawHome.siteSettings.map((item) => [item.settingKey, item.settingValue]));
const albumEntries = await Promise.all(albums.map(async (album) => [album.id, await get(`/gallery-albums/${album.id}`)]));
const snapshot = {
  generatedAt:new Date().toISOString(),
  home:{
    shopInfo:settings.shopInfo ?? {},
    liveUpdateConfig:settings.liveUpdateConfig ?? {},
    menuHidden:settings.siteVisibility?.menuHidden === true,
    navigation:rawHome.navigation ?? [],
    shopRules:rawHome.shopRules ?? [],
    slides:rawHome.slides ?? [],
    carousels:rawHome.carousels ?? [],
  },
  menu,
  albums,
  albumDetails:Object.fromEntries(albumEntries),
  staffRanking,
  monetaryRanking,
  guestbook,
};

await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Saved site snapshot to ${output}`);
