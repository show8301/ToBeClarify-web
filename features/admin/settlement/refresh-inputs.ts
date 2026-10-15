import type { SettlementStaffInput } from "./types";

const inputKey = (item: SettlementStaffInput) => `${item.staffId}:${item.role}`;

// Refresh server-derived hours while preserving fields the user has edited.
export function mergeRefreshedInputs(
  current: SettlementStaffInput[],
  previous: SettlementStaffInput[],
  refreshed: SettlementStaffInput[],
): SettlementStaffInput[] {
  const currentByKey = new Map(current.map(item => [inputKey(item), item]));
  const previousByKey = new Map(previous.map(item => [inputKey(item), item]));
  const refreshedKeys = new Set(refreshed.map(inputKey));
  const merged = refreshed.map(item => {
    const local = currentByKey.get(inputKey(item));
    const baseline = previousByKey.get(inputKey(item));
    if (!local) return item;
    if (!baseline) return local;
    return {
      ...item,
      actualMinutes: local.actualMinutes !== baseline.actualMinutes ? local.actualMinutes : item.actualMinutes,
      activityHours: local.activityHours !== baseline.activityHours ? local.activityHours : item.activityHours,
      attendanceSource: local.attendanceSource !== baseline.attendanceSource ? local.attendanceSource : item.attendanceSource,
      isBackstageParticipant: local.isBackstageParticipant !== baseline.isBackstageParticipant ? local.isBackstageParticipant : item.isBackstageParticipant,
      publicTipEligible: local.publicTipEligible !== baseline.publicTipEligible ? local.publicTipEligible : item.publicTipEligible,
      note: local.note !== baseline.note ? local.note : item.note,
    };
  });
  return [...merged, ...current.filter(item => !refreshedKeys.has(inputKey(item)))];
}
