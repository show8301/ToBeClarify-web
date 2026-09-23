import { guestbookProxy } from "@/features/guestbook/server/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; replyId: string }> }) {
  const { id, replyId } = await params;
  return guestbookProxy(request, `/${encodeURIComponent(id)}/replies/${encodeURIComponent(replyId)}`);
}
