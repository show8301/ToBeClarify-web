type ApiEnvelope = {
  success?: boolean;
  data?: unknown;
  message?: unknown;
  errorCode?: unknown;
  traceId?: unknown;
};

export class GuestbookError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
    public traceId: string | null = null,
    public retryAfter = 0,
  ) {
    super(message);
    this.name = "GuestbookError";
  }
}

const VISITOR_STORAGE_KEY = "guestbook-visitor-id";

function guestbookVisitorId() {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}

function isEnvelope(value: unknown): value is ApiEnvelope {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function guestbookUrl(path = "", query?: Record<string, string | number | null | undefined>) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") parameters.set(key, String(value));
  }
  const suffix = parameters.size ? `?${parameters}` : "";
  return `/api/guestbook${path}${suffix}`;
}

export async function guestbookRequest<T>(
  url: string,
  parse: (value: unknown) => T,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  const visitorId = guestbookVisitorId();
  try {
    response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(visitorId ? { "X-Guestbook-Visitor-Id": visitorId } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new GuestbookError("留言服務暫時無法連線，請稍後再試。");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isEnvelope(payload)) {
    throw new GuestbookError("留言服務回應格式不正確。", response.status, "INVALID_RESPONSE");
  }
  if (!response.ok || payload.success === false) {
    throw new GuestbookError(
      typeof payload.message === "string" ? payload.message : "留言服務暫時無法使用。",
      response.status,
      typeof payload.errorCode === "string" ? payload.errorCode : "API_ERROR",
      typeof payload.traceId === "string" ? payload.traceId : null,
      Number(response.headers.get("Retry-After")) || 0,
    );
  }
  try {
    return parse(payload.data);
  } catch (error) {
    throw new GuestbookError(
      error instanceof Error ? error.message : "留言服務回應格式不正確。",
      response.status,
      "INVALID_RESPONSE",
      typeof payload.traceId === "string" ? payload.traceId : null,
    );
  }
}
