import { guestbookLikeProxy } from "@/features/guestbook/server/proxy";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guestbookLikeProxy(request, (await params).id);
}
