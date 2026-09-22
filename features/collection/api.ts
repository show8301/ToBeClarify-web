import type { CollectionAccess, CollectionAsset, CollectionPageResult, CollectionWork } from "./types";

export class CollectionError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
    public traceId: string | null = null,
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseAsset(value: unknown): CollectionAsset {
  if (!isRecord(value) || typeof value.id !== "string" || !["image", "link"].includes(String(value.kind))
    || typeof value.label !== "string" || !nullableString(value.url) || !nullableString(value.contentType)
    || typeof value.byteSize !== "number" || typeof value.createdAt !== "string") {
    throw new Error("作品附件格式不正確，請稍後重新查詢。");
  }
  return {
    id: value.id, kind: value.kind === "image" ? "image" : "link", label: value.label,
    url: value.url, contentType: value.contentType, byteSize: value.byteSize, createdAt: value.createdAt,
  };
}

function parseWork(value: unknown): CollectionWork {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string"
    || !nullableString(value.description) || !nullableString(value.dueDate) || !nullableString(value.deliveredAt)
    || typeof value.createdAt !== "string" || !Array.isArray(value.assets)
    || (value.status !== "pending" && value.status !== "in_progress" && value.status !== "ready"
      && value.status !== "delivered" && value.status !== "cancelled")) {
    throw new Error("作品資料格式不正確，請稍後重新查詢。");
  }
  return {
    id: value.id, title: value.title, description: value.description, status: value.status,
    dueDate: value.dueDate, createdAt: value.createdAt, deliveredAt: value.deliveredAt,
    assets: value.assets.map(parseAsset),
  };
}

async function request<T>(path: string, access: CollectionAccess & { page?: number; pageSize?: number }, parse: (value: unknown) => T, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`/api/collection/${path}`, {
      method: "POST", cache: "no-store", signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(access),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new CollectionError("領取服務暫時無法連線，請稍後再試。");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload)) throw new CollectionError("領取服務回應格式不正確。", response.status, "INVALID_RESPONSE");
  if (!response.ok || payload.success !== true) {
    throw new CollectionError(
      typeof payload.message === "string" ? payload.message : "無法查詢作品，請確認領取資料。",
      response.status, typeof payload.errorCode === "string" ? payload.errorCode : "API_ERROR",
      typeof payload.traceId === "string" ? payload.traceId : null,
    );
  }
  try {
    return parse(payload.data);
  } catch (error) {
    throw new CollectionError(error instanceof Error ? error.message : "作品資料格式不正確。", response.status, "INVALID_RESPONSE");
  }
}

export const collectionApi = {
  lookup: (access: CollectionAccess, signal?: AbortSignal, page = 1): Promise<CollectionPageResult> => request("lookup", { ...access, page, pageSize: 20 }, (value) => {
    if (!isRecord(value) || !Array.isArray(value.items) || typeof value.page !== "number" || !Number.isInteger(value.page) || value.page < 1
      || typeof value.pageSize !== "number" || !Number.isInteger(value.pageSize) || value.pageSize < 1 || value.pageSize > 50
      || typeof value.hasMore !== "boolean") throw new Error("作品清單格式不正確。");
    return { items: value.items.map(parseWork), page: value.page, pageSize: value.pageSize, hasMore: value.hasMore };
  }, signal),
  acknowledge: (id: string, access: CollectionAccess, signal?: AbortSignal) =>
    request(`${encodeURIComponent(id)}/acknowledge`, access, parseWork, signal),
  image: async (workId: string, assetId: string, access: CollectionAccess, signal: AbortSignal) => {
    const headers: Record<string, string> = { Accept: "image/*" };
    if (access.claimCode) headers["X-Delivery-Code"] = access.claimCode;
    else headers["X-Customer-Uid"] = access.customerUid || "";
    const response = await fetch(`/api/collection/${encodeURIComponent(workId)}/assets/${encodeURIComponent(assetId)}`, {
      headers, signal, cache: "no-store", referrerPolicy: "no-referrer",
    });
    if (!response.ok || !/^image\/(jpeg|png|gif|webp|avif)(;|$)/i.test(response.headers.get("content-type") || "")) {
      throw new CollectionError("圖片暫時無法開啟，請重新查詢或聯絡店員。", response.status, "IMAGE_UNAVAILABLE");
    }
    return response.blob();
  },
};

export function safeCloudUrl(value: string | null) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
