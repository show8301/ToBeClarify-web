import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.marchgroup.net/api/client/staff-members";
const output = new URL("../app/data/staff-snapshot.json", import.meta.url);

async function request(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const listPayload = await request(API);
const list = listPayload.data ?? [];
const detailEntries = await mapWithConcurrency(list, 5, async (person) => {
  const payload = await request(`${API}/${person.id}`);
  return [person.id, payload.data];
});

const snapshot = { generatedAt: new Date().toISOString(), list, details: Object.fromEntries(detailEntries) };
await mkdir(new URL("../app/data/", import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Saved ${list.length} staff records to ${output.pathname}`);
