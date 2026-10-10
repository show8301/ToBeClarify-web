export type PreviewVariant = "tasks" | "customers" | "service";
export type ServiceStatus = "awaiting" | "confirmed" | "in_service" | "completed" | "manager";
export type PreviewAction = "pass" | "meal" | "room" | "commission" | "addon" | "extend" | "decline" | "exception";

export interface PreviewGuest {
  id: string;
  name: string;
  gameId: string;
  location: string;
  note: string;
  order: string;
  service: string;
  start: string;
  end: string;
  status: ServiceStatus;
  source: "顧客指名" | "經理轉單";
  reason?: string;
  departed: boolean;
  amount: number;
}

export interface ActionRequest {
  action: PreviewAction;
  guestId: string;
}

export const VARIANTS: { id: PreviewVariant; number: string; name: string; description: string }[] = [
  { id: "tasks", number: "01", name: "待辦優先", description: "先回覆指名，再處理服務與顧客需求。" },
  { id: "customers", number: "02", name: "顧客並排", description: "選一位顧客，在同一處完成營業操作。" },
  { id: "service", number: "03", name: "服務優先", description: "聚焦當下服務，隨時掌握下一段安排。" },
];

export function isPreviewVariant(value: unknown): value is PreviewVariant {
  return typeof value === "string" && VARIANTS.some((variant) => variant.id === value);
}

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  awaiting: "待我確認",
  confirmed: "已確認",
  in_service: "服務中",
  completed: "已完成",
  manager: "待經理協調",
};

export const SAMPLE_GUESTS: PreviewGuest[] = [
  { id: "moon", name: "洛月", gameId: "Tsuki Yoru", location: "大廳 · 3 號桌", note: "想輕鬆聊天；餐點請在服務後送上。", order: "DEMO-1010-018", service: "純陪伴 · 2 節", start: "22:00", end: "22:40", status: "in_service", source: "顧客指名", departed: false, amount: 200000 },
  { id: "star", name: "星野", gameId: "Hoshino Aster", location: "大廳 · 5 號桌", note: "第一次來店，想了解店內活動。", order: "DEMO-1010-021", service: "純陪伴 · 1 節", start: "22:50", end: "23:10", status: "awaiting", source: "顧客指名", departed: false, amount: 100000 },
  { id: "leaf", name: "青禾", gameId: "Aoba Green", location: "大廳 · 2 號桌", note: "希望先聊聊角色設定。", order: "DEMO-1010-022", service: "純陪伴 · 1 節", start: "23:20", end: "23:40", status: "awaiting", source: "經理轉單", reason: "經理凜：顧客未指定人員，請協助承接這一段服務。", departed: false, amount: 100000 },
  { id: "glass", name: "琉璃", gameId: "Ruri Lune", location: "大廳 · 6 號桌", note: "簽繪需求：角色半身，先確認委託內容。", order: "DEMO-1010-024", service: "委託洽談 · 1 節", start: "23:50", end: "00:10", status: "confirmed", source: "顧客指名", departed: false, amount: 100000 },
  { id: "cloud", name: "雲舟", gameId: "Kumo Sora", location: "大廳 · 1 號桌", note: "服務已完成，仍在店內用餐。", order: "DEMO-1010-012", service: "純陪伴 · 1 節", start: "21:20", end: "21:40", status: "completed", source: "顧客指名", departed: false, amount: 100000 },
];

export function createSampleGuests(): PreviewGuest[] {
  return SAMPLE_GUESTS.map((guest) => ({ ...guest }));
}

export function formatGil(amount: number): string {
  return `${amount.toLocaleString("zh-TW")} Gil`;
}
