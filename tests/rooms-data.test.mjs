import assert from "node:assert/strict";
import test from "node:test";
import { getRoomCatalogDisplay } from "../features/rooms/catalog-display.ts";

const catalog = {
  segmentMinutes: 20,
  rooms: [{
    id: "actual-room", roomName: "實際包廂", shortDescription: "介紹", detailContent: null,
    ownershipType: "common", ownerStaffId: null, ownerStaffName: null,
    segmentMinutes: 20, segmentPrice: 120000, photos: [],
  }],
};
const response = (data) => Response.json({ success: true, data });
let moduleNumber = 0;
const load = () => import(`../features/rooms/server/data.ts?rooms-test=${++moduleNumber}`);

test("catalog display uses labeled demos only for a successfully loaded empty list", () => {
  assert.equal(getRoomCatalogDisplay(null), null);
  assert.deepEqual(getRoomCatalogDisplay(catalog), { data: catalog, isDemo: false });
  const display = getRoomCatalogDisplay({ segmentMinutes: 30, rooms: [] });
  assert.equal(display.isDemo, true);
  assert.deepEqual(display.data.rooms.map((room) => room.roomName), ["海霧水庭", "水晶祕語廳"]);
});

test("cold room reads wait for real data and share the in-flight request", async (t) => {
  let resolveFetch;
  let calls = 0;
  t.mock.method(globalThis, "fetch", (_url, options) => {
    calls++;
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return new Promise((resolve) => { resolveFetch = resolve; });
  });
  const { getRoomsData } = await load();
  let settled = false;
  const first = getRoomsData().then((value) => { settled = true; return value; });
  const second = getRoomsData();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(calls, 1);
  resolveFetch(response(catalog));
  assert.deepEqual(await first, catalog);
  assert.deepEqual(await second, catalog);
  assert.deepEqual(await getRoomsData(), catalog);
  assert.equal(calls, 1);
});

test("failed cold reads return unavailable and recover after a short retry delay", async (t) => {
  let now = 1000;
  let calls = 0;
  t.mock.method(Date, "now", () => now);
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1) throw new DOMException("Timed out", "TimeoutError");
    return response(catalog);
  });
  const { getRoomsData, getRoomsDataForLivePage } = await load();
  assert.equal(await getRoomsData(), null);
  assert.deepEqual(await getRoomsDataForLivePage(), { segmentMinutes: 20, rooms: [] });
  now += 29999;
  assert.equal(await getRoomsData(), null);
  assert.equal(calls, 1);
  now++;
  assert.deepEqual(await getRoomsData(), catalog);
  assert.equal(calls, 2);
});

test("refresh failures keep actual data but a successful empty catalog clears it", async (t) => {
  let now = 1000;
  let calls = 0;
  t.mock.method(Date, "now", () => now);
  t.mock.method(console, "warn", () => {});
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 2) return new Response(null, { status: 503 });
    return response(calls === 1 ? catalog : { segmentMinutes: 20, rooms: [] });
  });
  const { getRoomsData } = await load();
  assert.deepEqual(await getRoomsData(), catalog);
  now += 600000;
  assert.deepEqual(await getRoomsData(), catalog);
  now += 30000;
  assert.deepEqual(await getRoomsData(), { segmentMinutes: 20, rooms: [] });
  assert.equal(calls, 3);
});

test("invalid upstream catalogs do not become usable cached data", async (t) => {
  t.mock.method(console, "warn", () => {});
  for (const invalid of [
    { rooms: [] },
    { segmentMinutes: 20, rooms: [{ ...catalog.rooms[0], photos: null }] },
    { segmentMinutes: 20, rooms: [{ ...catalog.rooms[0], segmentPrice: "120000" }] },
  ]) {
    t.mock.method(globalThis, "fetch", async () => response(invalid));
    const { getRoomsData } = await load();
    assert.equal(await getRoomsData(), null);
  }
});
