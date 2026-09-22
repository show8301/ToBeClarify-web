import { adminRequest, ApiError } from "@/features/admin/api/client.js";
import { queryPath } from "./presentation";
import { parseCustomerDetail, parseCustomerProfile, parseDeliveries, parseDelivery, parseDeliveryIssued, parseHistory, parseIdentityCandidates } from "./validation";
import type { CreateDelivery, UpdateDelivery } from "./types";

async function request<T>(path: string, parse: (value: unknown) => T, options: RequestInit = {}): Promise<T> {
  const value: unknown = await adminRequest(path, options);
  try { return parse(value); }
  catch { throw new ApiError("顧客／作品服務回應格式不正確，請重新整理。", { status: 502, code: "INVALID_RESPONSE" }); }
}
const json = (method: string, body: unknown, signal?: AbortSignal): RequestInit => ({ method, body: JSON.stringify(body), signal });
const deliveryPath = (id: string) => `/art-deliveries/${encodeURIComponent(id)}`;

export const customerApi = {
  history: (values: { businessDate: string; search: string; page: number }, signal: AbortSignal) => request(queryPath("/customer-history", { ...values, pageSize: 30 }), parseHistory, { signal }),
  detail: (uid: string, signal: AbortSignal) => request(`/customers/${encodeURIComponent(uid)}`, parseCustomerDetail, { signal }),
  linkProfile: (sessionId: string, customerUid: string | null, signal: AbortSignal) => request(`/order-sessions/${encodeURIComponent(sessionId)}/customer-profile`, parseCustomerProfile, json("POST", { customerUid }, signal)),
  candidates: (gameId: string, signal: AbortSignal) => request(`/customer-identity/candidates?gameId=${encodeURIComponent(gameId)}`, parseIdentityCandidates, { signal }),
  deliveries: (values: { sessionId: string; search: string; status: string; page: number }, signal: AbortSignal) => request(queryPath("/art-deliveries", { ...values, pageSize: 30 }), parseDeliveries, { signal }),
  createDelivery: (body: CreateDelivery, signal: AbortSignal) => request("/art-deliveries", parseDeliveryIssued, json("POST", body, signal)),
  updateDelivery: (id: string, body: UpdateDelivery, signal: AbortSignal) => request(deliveryPath(id), parseDelivery, json("PUT", body, signal)),
  reissueCode: (id: string, signal: AbortSignal) => request(`${deliveryPath(id)}/reissue-code`, parseDeliveryIssued, { method: "POST", signal }),
  addLink: (id: string, label: string, url: string, signal: AbortSignal) => request(`${deliveryPath(id)}/assets/link`, parseDelivery, json("POST", { label, url }, signal)),
  upload: (id: string, label: string, file: File, signal: AbortSignal) => {
    const body = new FormData();
    body.append("file", file);
    body.append("label", label);
    return request(`${deliveryPath(id)}/assets/upload`, parseDelivery, { method: "POST", body, signal });
  },
  removeAsset: (id: string, assetId: string, signal: AbortSignal) => request(`${deliveryPath(id)}/assets/${encodeURIComponent(assetId)}`, parseDelivery, { method: "DELETE", signal }),
};
