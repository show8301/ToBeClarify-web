import { adminRequest } from "@/features/admin/api/client.js";
import type { SettlementRule } from "./types";

export function parseSettlementRule(value: unknown): SettlementRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("規則版本資料格式錯誤。");
  const row = Object.fromEntries(Object.entries(value));
  if (typeof row.id !== "string" || !row.id || (row.dayType !== "normal" && row.dayType !== "event") ||
      typeof row.effectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveFrom) || row.publicTipMode !== "hour_ratio") {
    throw new Error("規則版本識別或生效日期格式錯誤。");
  }
  function number(key: string): number {
    const value = row[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("規則金額或比例格式錯誤。");
    return value;
  }
  return { id: row.id, dayType: row.dayType, effectiveFrom: row.effectiveFrom, publicTipMode: row.publicTipMode,
    designatedHourlyRate: number("designatedHourlyRate"), serviceManagerHourlyRate: number("serviceManagerHourlyRate"),
    backstageHourlyRate: number("backstageHourlyRate"), designatedSharePercentage: number("designatedSharePercentage"),
    publicRoomStaffPercentage: number("publicRoomStaffPercentage"), dedicatedRoomOwnerPercentage: number("dedicatedRoomOwnerPercentage"),
    serviceManagerPoolPercentage: number("serviceManagerPoolPercentage"), backstagePoolPercentage: number("backstagePoolPercentage"),
    companyPercentage: number("companyPercentage"), timeRoundMinutes: number("timeRoundMinutes"), moneyRoundUnit: number("moneyRoundUnit") };
}
export async function getSettlementRules(signal?: AbortSignal): Promise<SettlementRule[]> {
  const value: unknown = await adminRequest("/settlement/rules", { signal });
  if (!Array.isArray(value)) throw new Error("規則版本清單格式錯誤。");
  return value.map(parseSettlementRule);
}
