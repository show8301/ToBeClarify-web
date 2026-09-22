import { publicClientApiUrl } from "@/lib/server/upstream-config";

const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const BODYLESS = new Set([204, 205, 304]);
type ProxyOptions = { path: string; image?: boolean; orderIdentity?: boolean };

function fail(message: string, status: number, errorCode: string) {
  return Response.json({ success: false, message, errorCode }, { status, headers: NO_STORE });
}

async function readAccess(request: Request, orderIdentity: boolean) {
  const reader = request.body?.getReader();
  if (!reader) return orderIdentity ? {} : null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 2048) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const input = value as Record<string, unknown>;
    const output: Record<string, string | number> = {};
    for (const key of ["claimCode", "customerUid"]) {
      if (input[key] === undefined || input[key] === null) continue;
      if (typeof input[key] !== "string" || input[key].length > (key === "customerUid" ? 40 : 100)) return null;
      output[key] = input[key].trim();
    }
    if (!orderIdentity) {
      for (const key of ["page", "pageSize"]) {
        if (input[key] === undefined) continue;
        if (typeof input[key] !== "number" || !Number.isInteger(input[key]) || input[key] < 1 || input[key] > (key === "pageSize" ? 50 : 100000)) return null;
        output[key] = input[key];
      }
    }
    if (orderIdentity) {
      if (output.claimCode || Boolean(output.customerUid)) return null;
    } else if (output.claimCode ? Boolean(output.customerUid) : !output.customerUid) {
      return null;
    }
    return output;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function customerPortalProxy(request: Request, options: ProxyOptions) {
  const headers = new Headers({ Accept: options.image ? "image/*" : "application/json" });
  let body: string | undefined;
  if (request.method === "POST") {
    // Only an explicitly configured external origin is trusted behind IIS.
    const expectedOrigin = process.env.CUSTOMER_PORTAL_PUBLIC_ORIGIN || process.env.GUESTBOOK_PUBLIC_ORIGIN || new URL(request.url).origin;
    if (request.headers.get("origin") !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
      return fail("請由本網站操作作品領取。", 403, "CUSTOMER_ORIGIN_MISMATCH");
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return fail("請使用正確的領取資料格式。", 415, "CUSTOMER_INVALID_CONTENT_TYPE");
    }
    const value = await readAccess(request, Boolean(options.orderIdentity));
    if (!value) return fail("請填寫完整的單筆領取碼或顧客 UID。", 400, "CUSTOMER_INVALID_CREDENTIALS");
    body = JSON.stringify(value);
    headers.set("Content-Type", "application/json");
  }
  for (const name of options.orderIdentity ? ["x-order-token"] : ["x-delivery-code", "x-customer-uid"]) {
    const value = request.headers.get(name);
    if (!value) continue;
    if (value.length > (name === "x-order-token" ? 2048 : 100)) return fail("領取資料格式不正確。", 400, "CUSTOMER_INVALID_CREDENTIALS");
    headers.set(name, value);
  }
  try {
    const upstream = await fetch(publicClientApiUrl(options.path), {
      method: request.method, headers, body, cache: "no-store", redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
    });
    if (upstream.status >= 300 && upstream.status < 400) return fail("領取服務暫時無法使用。", 502, "CUSTOMER_UPSTREAM_REDIRECT");
    const contentType = upstream.headers.get("content-type") || "";
    const hasBody = !BODYLESS.has(upstream.status);
    const isRaster = /^image\/(jpeg|png|gif|webp|avif)(;|$)/i.test(contentType);
    if (hasBody && !contentType.includes("application/json") && !(options.image && upstream.ok && isRaster)) {
      return fail("領取服務回應格式不正確。", 502, "CUSTOMER_INVALID_RESPONSE");
    }
    const outputHeaders = new Headers(NO_STORE);
    if (hasBody) outputHeaders.set("Content-Type", contentType);
    const retry = upstream.headers.get("Retry-After");
    if (retry) outputHeaders.set("Retry-After", retry);
    outputHeaders.set("X-Content-Type-Options", "nosniff");
    return new Response(hasBody ? upstream.body : null, { status: upstream.status, headers: outputHeaders });
  } catch {
    return fail("領取服務暫時無法連線，請稍後再試。", 502, "CUSTOMER_UPSTREAM_UNAVAILABLE");
  }
}
