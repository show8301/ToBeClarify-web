import { adminRequest, ApiError } from "@/features/admin/api/client.js";

export async function adminGuestbookRequest<T>(
  path: string,
  parse: (value: unknown) => T,
  options: RequestInit = {},
): Promise<T> {
  const data: unknown = await adminRequest(`/guestbook${path}`, options);
  try {
    return parse(data);
  } catch {
    throw new ApiError("留言服務回應格式不正確。", {
      status: 502,
      code: "INVALID_RESPONSE",
    });
  }
}

export function adminGuestbookPath(path: string, query?: Record<string, string | number | null | undefined>) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") parameters.set(key, String(value));
  }
  return parameters.size ? `${path}?${parameters}` : path;
}
