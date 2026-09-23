import { publicClientApiUrl } from "@/lib/server/upstream-config";
import { parseGuestbookMessage, parseGuestbookReplies } from "@/features/guestbook/validation";
import type { GuestbookMessage, GuestbookReplies } from "@/features/guestbook/types";

async function readMessage(path: string): Promise<GuestbookMessage | null> {
  try {
    const response = await fetch(publicClientApiUrl(path), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || !("data" in payload)) return null;
    return parseGuestbookMessage(payload.data);
  } catch {
    return null;
  }
}

export function getPublicGuestbookThread(id: string) {
  return readMessage(`/guestbook/threads/${encodeURIComponent(id)}`);
}

export function getPublicGuestbookReply(threadId: string, replyId: string) {
  return readMessage(`/guestbook/threads/${encodeURIComponent(threadId)}/replies/${encodeURIComponent(replyId)}`);
}

export async function getPublicGuestbookReplies(threadId: string, targetReplyId?: string): Promise<GuestbookReplies | null> {
  try {
    const query = new URLSearchParams({ page: "1", pageSize: "20" });
    const response = await fetch(publicClientApiUrl(`/guestbook/threads/${encodeURIComponent(threadId)}/replies?${query}`), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || !("data" in payload)) return null;
    const result = parseGuestbookReplies(payload.data);
    if (!targetReplyId || result.items.some((item) => item.id === targetReplyId)) return result;
    const target = await getPublicGuestbookReply(threadId, targetReplyId);
    if (!target) return result;
    return {
      ...result,
      items: [...result.items, target].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    };
  } catch {
    return null;
  }
}
