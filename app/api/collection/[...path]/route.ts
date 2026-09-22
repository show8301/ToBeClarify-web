import { customerPortalProxy } from "@/lib/server/customer-portal-proxy";

type RouteContext = { params: Promise<{ path: string[] }> };
const ID = /^[a-zA-Z0-9-]{1,64}$/;

async function proxy(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const lookup = request.method === "POST" && path.length === 1 && path[0] === "lookup";
  const acknowledge = request.method === "POST" && path.length === 2 && ID.test(path[0]) && path[1] === "acknowledge";
  const image = request.method === "GET" && path.length === 3 && ID.test(path[0]) && path[1] === "assets" && ID.test(path[2]);
  if (!lookup && !acknowledge && !image) {
    return Response.json({ success: false, message: "找不到此領取服務。", errorCode: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return customerPortalProxy(request, { path: `/art-deliveries/${path.map(encodeURIComponent).join("/")}`, image });
}

export const POST = proxy;
export const GET = proxy;
