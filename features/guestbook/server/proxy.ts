import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { publicClientApiUrl } from "@/lib/server/upstream-config";

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};
const BODYLESS_RESPONSE_STATUSES = new Set([204, 205, 304]);

function fail(message: string, status: number) {
  return Response.json({ success: false, message }, { status, headers: responseHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // IIS may expose an internal http URL to Node. Trust only an explicitly
  // configured external origin, never an arbitrary forwarded-host header.
  const expectedOrigin = process.env.GUESTBOOK_PUBLIC_ORIGIN || new URL(request.url).origin;
  return Boolean(origin && origin === expectedOrigin && request.headers.get("sec-fetch-site") !== "cross-site");
}

function attachTrustedVisitor(request: Request, headers: Headers, requireIp: boolean, requireVisitor: boolean) {
  const visitorId = request.headers.get("x-guestbook-visitor-id")?.trim() || "";
  if (visitorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitorId)) {
    return fail("留言來源驗證失敗。", 400);
  }
  if (requireVisitor && !visitorId) return fail("請重新載入留言板後再試。", 400);
  if (!visitorId && !requireIp) return null;

  // Configure this only for an edge/IIS header overwritten by the trusted proxy.
  const ipHeader = process.env.GUESTBOOK_TRUSTED_IP_HEADER;
  const ip = ipHeader ? request.headers.get(ipHeader)?.trim() : "";
  const secret = process.env.GUESTBOOK_PROXY_SECRET || "";
  if (!ip || !isIP(ip) || secret.length < 32) {
    return requireIp ? fail("留言功能暫時無法送出，請稍後再試。", 503) : null;
  }

  const time = Math.floor(Date.now() / 1000).toString();
  headers.set("X-Guestbook-IP", ip);
  headers.set("X-Guestbook-Time", time);
  if (visitorId) headers.set("X-Guestbook-Visitor-Id", visitorId);
  const signedValue = visitorId ? `${time}\n${ip}\n${visitorId}` : `${time}\n${ip}`;
  headers.set("X-Guestbook-Signature", createHmac("sha256", secret).update(signedValue).digest("hex"));
  return null;
}

async function readBoundedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return { response: fail("請輸入留言。", 400) };

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 3 * 1024 * 1024) {
        await reader.cancel();
        return { response: fail("留言內容過長。", 413) };
      }
      chunks.push(chunk.value);
    }
  } catch {
    return { response: fail("留言傳送中斷，請重試。", 400) };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { response: fail("留言格式不正確。", 400) };
  }
  if (!isRecord(parsed)) return { response: fail("請填寫名字與留言內容。", 400) };
  return { value: parsed };
}

async function preparePost(request: Request, headers: Headers) {
  if (!validateOrigin(request)) {
    return { response: fail("請由本網站送出留言。", 403) };
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { response: fail("不支援的留言格式。", 415) };
  }

  const result = await readBoundedJson(request);
  if (result.response) return result;
  const input = result.value;
  if (
    typeof input.displayName !== "string"
    || typeof input.content !== "string"
    || (input.website !== undefined && typeof input.website !== "string")
    || (input.customerUid !== undefined && (typeof input.customerUid !== "string" || input.customerUid.length > 40))
    || (input.imageBase64 !== undefined && (typeof input.imageBase64 !== "string" || input.imageBase64.length > 2_796_204))
  ) {
    return { response: fail("請填寫名字與留言內容。", 400) };
  }
  if (input.imageBase64 !== undefined && !input.customerUid) {
    return { response: fail("圖片留言需要顧客 UID。", 403) };
  }

  const identityError = attachTrustedVisitor(request, headers, true, false);
  if (identityError) return { response: identityError };
  headers.set("Content-Type", "application/json");
  return {
    body: JSON.stringify({
      displayName: input.displayName,
      content: input.content,
      website: input.website ?? "",
      customerUid: input.customerUid,
      imageBase64: input.imageBase64,
    }),
  };
}

export async function guestbookLikeProxy(request: Request, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail("找不到留言。", 404);
  }
  if (!validateOrigin(request)) return fail("請由本網站送出操作。", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("不支援的請求格式。", 415);
  const result = await readBoundedJson(request);
  if (result.response) return result.response;
  if (typeof result.value.liked !== "boolean") return fail("點讚資料格式不正確。", 400);

  const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json" });
  const identityError = attachTrustedVisitor(request, headers, true, true);
  if (identityError) return identityError;
  try {
    const upstream = await fetch(publicClientApiUrl(`/guestbook/items/${encodeURIComponent(id)}/like`), {
      method: "POST",
      headers,
      body: JSON.stringify({ liked: result.value.liked }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { "Cache-Control": "no-store", "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8" },
    });
  } catch {
    return fail("留言服務暫時無法連線，請稍後再試。", 502);
  }
}

export async function guestbookImageProxy(request: Request, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return fail("找不到留言圖片。", 404);
  }
  try {
    const upstream = await fetch(publicClientApiUrl(`/guestbook/images/${encodeURIComponent(id)}`), {
      cache: "no-store",
      redirect: "manual",
      headers: { Accept: "image/webp" },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
    if (!upstream.ok) return fail("留言圖片目前無法顯示。", upstream.status === 404 ? 404 : 502);
    if (upstream.headers.get("content-type")?.split(";")[0] !== "image/webp") {
      return fail("圖片格式不正確。", 502);
    }
    return new Response(upstream.body, { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    return fail("留言圖片服務暫時無法連線。", 502);
  }
}

export async function guestbookProxy(request: Request, suffix = "") {
  const headers = new Headers({ Accept: "application/json" });
  let body: string | undefined;
  if (request.method === "POST") {
    const post = await preparePost(request, headers);
    if ("response" in post) return post.response;
    body = post.body;
  } else {
    const visitorError = attachTrustedVisitor(request, headers, false, false);
    if (visitorError) return visitorError;
  }

  const url = new URL(publicClientApiUrl(`/guestbook/threads${suffix}`));
  const query = new URL(request.url).searchParams;
  for (const name of ["page", "pageSize", "cursor"]) {
    const value = query.get(name);
    if (value) url.searchParams.set(name, value);
  }

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return fail("留言服務暫時無法使用。", 502);
    }

    const responseHasBody = request.method !== "HEAD"
      && !BODYLESS_RESPONSE_STATUSES.has(upstream.status);
    const contentType = upstream.headers.get("content-type");
    if (responseHasBody && !contentType?.toLowerCase().includes("application/json")) {
      return fail("留言服務回應格式不正確。", 502);
    }

    const outputHeaders = new Headers({ "Cache-Control": "no-store" });
    if (responseHasBody) {
      outputHeaders.set("Content-Type", contentType || "application/json; charset=utf-8");
    }
    const retry = upstream.headers.get("Retry-After");
    if (retry) outputHeaders.set("Retry-After", retry);
    return new Response(responseHasBody ? await upstream.arrayBuffer() : null, {
      status: upstream.status,
      headers: outputHeaders,
    });
  } catch {
    return fail("留言服務暫時無法連線，請稍後再試。", 502);
  }
}
