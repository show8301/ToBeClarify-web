import type { SettlementOverview } from "./types";

// Existing overview fields retain their current contract; validate the new external payload before rendering.
export function validatePublicTipPool(overview: SettlementOverview): SettlementOverview {
  const value: unknown = overview.publicTipPool;
  if (value == null) return overview;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("公共小費來源格式錯誤。");
  const row = Object.fromEntries(Object.entries(value));
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (!number(row.recognizedAmount) || !number(row.distributableAmount) || !Array.isArray(row.sources)) throw new Error("公共小費金額格式錯誤。");
  if (row.legacyStoreSources != null && !Array.isArray(row.legacyStoreSources)) throw new Error("舊店家小費來源格式錯誤。");
  const legacy: unknown[] = Array.isArray(row.legacyStoreSources) ? row.legacyStoreSources : [];
  for (const source of [...row.sources, ...legacy]) {
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("公共小費訂單格式錯誤。");
    const fields = Object.fromEntries(Object.entries(source));
    if (!["orderId", "orderNumber", "status"].every(key => typeof fields[key] === "string") ||
        !["originalAmount", "orderPayableAmount", "orderCollectedAmount", "recognizedAmount"].every(key => number(fields[key]))) {
      throw new Error("公共小費訂單欄位格式錯誤。");
    }
  }
  return overview;
}
