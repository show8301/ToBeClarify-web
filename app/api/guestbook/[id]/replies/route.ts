import { guestbookProxy } from "@/features/guestbook/server/proxy";

type Context = { params: Promise<{ id: string }> };

async function proxy(request: Request, { params }: Context) {
  const { id } = await params;
  return guestbookProxy(request, `/${encodeURIComponent(id)}/replies`);
}
export const GET = proxy;
export const POST = proxy;
