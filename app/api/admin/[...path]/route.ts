const DEFAULT_ADMIN_API_BASE_URL = "https://api.marchgroup.net/api/admin";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BODYLESS_RESPONSE_STATUSES = new Set([204, 205, 304]);

type RouteContext = { params: Promise<{ path: string[] }> };

function adminApiBaseUrl() {
  return (process.env.ADMIN_API_BASE_URL?.trim() || DEFAULT_ADMIN_API_BASE_URL).replace(/\/$/, "");
}

export function isSameOriginRequest(request: Request) {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  const allowedHosts = [
    new URL(request.url).host,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host")?.split(",", 1)[0],
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => host.trim().toLowerCase());

  return allowedHosts.includes(originHost);
}

function rewriteAdminCookie(value: string, request: Request) {
  const secureRequest = new URL(request.url).protocol === "https:";
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !part.toLowerCase().startsWith("domain="))
    .filter((part) => secureRequest || part.toLowerCase() !== "secure")
    .map((part) => part.toLowerCase().startsWith("samesite=") ? "SameSite=Lax" : part)
    .join("; ");
}

async function proxy(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { success: false, message: "拒絕跨站管理請求。", errorCode: "ADMIN_ORIGIN_MISMATCH" },
      { status: 403 },
    );
  }

  const { path } = await params;
  const upstreamUrl = new URL(`${adminApiBaseUrl()}/${path.map(encodeURIComponent).join("/")}`);
  upstreamUrl.search = new URL(request.url).search;

  const headers = new Headers({ Accept: request.headers.get("accept") || "application/json" });
  for (const name of ["content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });

    const responseHasBody = method !== "HEAD" && !BODYLESS_RESPONSE_STATUSES.has(upstream.status);
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    if (responseHasBody) {
      responseHeaders.set(
        "Content-Type",
        upstream.headers.get("content-type") || "application/json; charset=utf-8",
      );
    }
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) responseHeaders.set("Set-Cookie", rewriteAdminCookie(setCookie, request));

    return new Response(responseHasBody ? await upstream.arrayBuffer() : null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { success: false, message: "管理 API 暫時無法連線。", errorCode: "ADMIN_UPSTREAM_UNAVAILABLE" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
