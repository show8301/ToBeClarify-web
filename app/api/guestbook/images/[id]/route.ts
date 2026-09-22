import { guestbookImageProxy } from "@/features/guestbook/server/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guestbookImageProxy(request, (await params).id);
}
