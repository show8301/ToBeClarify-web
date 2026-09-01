import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path="/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Lucid Dream public routes", async () => {
  const routes = [
    ["/", /LUCID/],
    ["/staff", /MEET THE/],
    ["/gallery", /EORZEA/],
    ["/menu", /MENU/],
    ["/guestbook", /AFTER/],
    ["/liveupdate", /LIVE/],
    ["/staffRanking", /HALL OF/],
    ["/monetaryRanking", /HALL OF/],
  ];
  for (const [path,marker] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /清醒夢/);
    assert.match(html, marker);
    assert.doesNotMatch(html, /codex-preview|_sites-preview/i);
  }
});

test("server-renders every addressable admin route", async () => {
  for (const path of ["/admin", "/admin/login", "/admin/forgot-password", "/admin/home", "/admin/staff", "/admin/events", "/admin/menu"]) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /正在確認後台通行資格/);
    assert.doesNotMatch(html, /codex-preview|_sites-preview/i);
  }
});

test("renders route-addressable gallery content over the archive", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../data/snapshots/site.json", import.meta.url), "utf8"));
  const album = snapshot.albums[0];
  assert.ok(album?.id);
  const response = await render(`/gallery/${album.id}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /weekly-page/);
  assert.match(html, /weekly-modal/);
  assert.match(html, new RegExp(album.albumTitle));
  assert.match(html, /向下拖曳關閉相簿/);
  assert.match(html, /關閉相簿/);
});

test("keeps a current API snapshot for resilient first paint", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../data/snapshots/site.json", import.meta.url), "utf8"));
  assert.ok(Date.parse(snapshot.generatedAt));
  assert.equal(snapshot.home.shopInfo.name, "清醒夢");
  assert.ok(snapshot.albums.length > 0);
  assert.ok(snapshot.menu.categories.length > 0);
  assert.ok(snapshot.guestbook.items.length > 0);
});
