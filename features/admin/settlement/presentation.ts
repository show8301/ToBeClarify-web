export const settlementMoney = (value: number) => Math.ceil(Number(value || 0)).toLocaleString("zh-TW");

export const settlementRoles: Record<string, string> = {
  designated: "指名人員",
  service: "服務生",
  manager: "經理",
  backstage: "幕後技術",
  dedicated_room_owner: "專屬包廂分成",
  activity: "活動日分配",
};

export const settlementStatuses: Record<string, string> = {
  draft: "尚未結算",
  calculated: "已計算預覽",
  finalized: "已正式結算",
  pending: "待核准",
  approved: "已核准",
  rejected: "未核准",
};

export const settlementPeriodStatuses: Record<string, string> = {
  scheduled: "尚未開店",
  open: "營業中",
  closed: "已關店",
  settled: "已結算",
};
