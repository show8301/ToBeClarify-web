const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const CLIENT_API_BASE_URL = (configuredBaseUrl || "https://api.marchgroup.net/api/client").replace(/\/$/, "");

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
};

export class ClientApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
  }
}

export async function clientApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${CLIENT_API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ClientApiError("無法連線至 API，請稍後再試。");
  }

  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | T | null;
  const envelope = payload && typeof payload === "object" ? payload as ApiEnvelope<T> : null;
  if (!response.ok || envelope?.success === false) {
    throw new ClientApiError(envelope?.message || envelope?.error || `API 請求失敗（HTTP ${response.status}）`, response.status);
  }
  if (envelope && Object.prototype.hasOwnProperty.call(envelope, "data")) return envelope.data as T;
  return payload as T;
}

export function clientApiPath(path: string, params: Record<string, string | number | null | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

export { CLIENT_API_BASE_URL };
