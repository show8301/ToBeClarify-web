import type {
  GuestbookAuthor,
  GuestbookHistoryEntry,
  GuestbookList,
  GuestbookMessage,
  GuestbookReplies,
  GuestbookSettings,
} from "@/features/guestbook/types";

const AUTHORS = new Set<GuestbookAuthor>([
  "customer",
  "staff",
  "mascot",
  "anonymous_staff",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(record: Record<string, unknown>, key: string): string {
  if (typeof record[key] !== "string") throw new Error(`留言資料缺少 ${key}。`);
  return record[key];
}

function integerValue(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`留言資料的 ${key} 格式不正確。`);
  return value;
}

function booleanValue(record: Record<string, unknown>, key: string): boolean {
  if (typeof record[key] !== "boolean") throw new Error(`留言資料的 ${key} 格式不正確。`);
  return record[key];
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value !== null && typeof value !== "string") throw new Error(`留言資料的 ${key} 格式不正確。`);
  return value;
}

function messageArray(value: unknown): GuestbookMessage[] {
  if (!Array.isArray(value)) throw new Error("留言清單格式不正確。");
  return value.map(parseGuestbookMessage);
}

export function parseGuestbookMessage(value: unknown): GuestbookMessage {
  if (!isRecord(value)) throw new Error("留言資料格式不正確。");
  const authorType = stringValue(value, "authorType");
  if (!AUTHORS.has(authorType as GuestbookAuthor)) throw new Error("留言作者類型不正確。");
  return {
    id: stringValue(value, "id"),
    threadId: stringValue(value, "threadId"),
    displayName: stringValue(value, "displayName"),
    content: stringValue(value, "content"),
    authorType: authorType as GuestbookAuthor,
    isVisible: booleanValue(value, "isVisible"),
    isPinned: booleanValue(value, "isPinned"),
    sortOrder: integerValue(value, "sortOrder"),
    allowReplies: booleanValue(value, "allowReplies"),
    replyCount: integerValue(value, "replyCount"),
    hiddenReplyCount: value.hiddenReplyCount === undefined ? 0 : integerValue(value, "hiddenReplyCount"),
    version: integerValue(value, "version"),
    createdAt: stringValue(value, "createdAt"),
    editedAt: nullableString(value, "editedAt"),
    customerUid: value.customerUid === undefined ? null : nullableString(value, "customerUid"),
    imageId: value.imageId === undefined ? null : nullableString(value, "imageId"),
    likeCount: value.likeCount === undefined ? 0 : integerValue(value, "likeCount"),
    viewerLiked: value.viewerLiked === undefined ? false : booleanValue(value, "viewerLiked"),
  };
}

function parsePage(value: unknown) {
  if (!isRecord(value)) throw new Error("留言分頁格式不正確。");
  return {
    record: value,
    page: integerValue(value, "page"),
    pageSize: integerValue(value, "pageSize"),
    totalCount: integerValue(value, "totalCount"),
    nextCursor: nullableString(value, "nextCursor"),
    items: messageArray(value.items),
  };
}

export function parseGuestbookList(value: unknown): GuestbookList {
  const page = parsePage(value);
  return { ...page, pinnedItems: messageArray(page.record.pinnedItems) };
}

export function parseGuestbookReplies(value: unknown): GuestbookReplies {
  const page = parsePage(value);
  return {
    page: page.page,
    pageSize: page.pageSize,
    totalCount: page.totalCount,
    nextCursor: page.nextCursor,
    items: page.items,
  };
}

export function parseGuestbookSettings(value: unknown): GuestbookSettings {
  if (!isRecord(value)) throw new Error("留言板設定格式不正確。");
  return { mascotName: stringValue(value, "mascotName"), version: integerValue(value, "version") };
}

export function parseGuestbookHistory(value: unknown): GuestbookHistoryEntry[] {
  if (!Array.isArray(value)) throw new Error("留言操作紀錄格式不正確。");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("留言操作紀錄格式不正確。");
    return {
      id: integerValue(item, "id"),
      messageId: stringValue(item, "messageId"),
      actorId: stringValue(item, "actorId"),
      action: stringValue(item, "action"),
      beforeValue: nullableString(item, "beforeValue"),
      afterValue: nullableString(item, "afterValue"),
      createdAt: stringValue(item, "createdAt"),
    };
  });
}

export function parseTrue(value: unknown): true {
  if (value !== true) throw new Error("留言操作回應格式不正確。");
  return true;
}

export function parseGuestbookLikeResult(value: unknown) {
  if (!isRecord(value)) throw new Error("點讚回應格式不正確。");
  return {
    likeCount: integerValue(value, "likeCount"),
    liked: booleanValue(value, "liked"),
  };
}
