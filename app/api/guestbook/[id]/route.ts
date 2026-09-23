import { guestbookProxy } from "@/features/guestbook/server/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guestbookProxy(request, `/${encodeURIComponent((await params).id)}`);
}
