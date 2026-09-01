import { getOrderingApiBaseUrl } from "@/lib/server/upstream-config";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RouteContext = { params: Promise<{ path: string[] }> };

function isSameOriginRequest(request: Request) {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try { originHost = new URL(origin).host.toLowerCase(); } catch { return false; }
  return [new URL(request.url).host, request.headers.get("host"), request.headers.get("x-forwarded-host")?.split(",", 1)[0]]
    .filter((host): host is string => Boolean(host))
    .map((host) => host.trim().toLowerCase())
    .includes(originHost);
}

async function proxy(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ success: false, message: "拒絕跨站點餐請求。", errorCode: "ORDER_ORIGIN_MISMATCH" }, { status: 403 });
  }
  const { path } = await params;
  const upstreamUrl = new URL(`${getOrderingApiBaseUrl()}/${path.map(encodeURIComponent).join("/")}`);
  upstreamUrl.search = new URL(request.url).search;
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["content-type", "x-order-token"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const method = request.method.toUpperCase();
  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    return new Response(method === "HEAD" || upstream.status === 204 ? null : await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ success: false, message: "點餐服務暫時無法連線。", errorCode: "ORDER_UPSTREAM_UNAVAILABLE" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
