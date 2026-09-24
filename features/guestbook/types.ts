export type GuestbookAuthor = "customer" | "staff" | "mascot" | "anonymous_staff";
export type GuestbookSubmission = {
  displayName: string;
  content: string;
  website: string;
  customerUid?: string;
  imageBase64?: string;
};
export type GuestbookMessage = {
  id: string;
  threadId: string;
  displayName: string;
  content: string;
  authorType: GuestbookAuthor;
  isVisible: boolean;
  isPinned: boolean;
  sortOrder: number;
  allowReplies: boolean;
  replyCount: number;
  hiddenReplyCount: number;
  version: number;
  createdAt: string;
  editedAt: string | null;
  customerUid: string | null;
  imageId: string | null;
  likeCount: number;
  viewerLiked: boolean;
};
export type GuestbookLikeResult = { likeCount: number; liked: boolean };
export type GuestbookList = {
  page: number;
  pageSize: number;
  totalCount: number;
  nextCursor: string | null;
  items: GuestbookMessage[];
  pinnedItems: GuestbookMessage[];
};
export type GuestbookReplies = Omit<GuestbookList, "pinnedItems">;
export type GuestbookSettings = { mascotName: string; version: number };
export type GuestbookHistoryEntry = {
  id: number;
  messageId: string;
  actorId: string;
  action: string;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: string;
};
