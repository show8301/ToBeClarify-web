import { adminRequest, ApiError } from "@/features/admin/api/client.js";
import { customerApi } from "@/features/admin/customers/api";
import { queryPath } from "@/features/admin/customers/presentation";
import { parseDelivery, parseDeliveries } from "@/features/admin/customers/validation";
import type { ArtDelivery } from "@/features/admin/customers/types";

export type DeliveryScope = "mine" | "all" | "unassigned";
export type WorkspaceQuery = { sessionId: string; search: string; status: string; page: number; scope: DeliveryScope; sort: string };
export type DeliveryStaff = { id: string; displayName: string };
export type DeliveryWorkspace = { items: ArtDelivery[]; totalCount: number | null; page: number; pageSize: number; staff: DeliveryStaff[]; available: boolean };
export type DeliveryHistory = { id: string; action: string; actorName: string | null; createdAt: string };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}
function string(value: unknown): string { if (typeof value !== "string") throw new Error("Invalid string"); return value; }
function integer(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid integer"); return value; }
function list<T>(value: unknown, parser: (item: unknown) => T): T[] { if (!Array.isArray(value)) throw new Error("Invalid list"); return value.map(parser); }
async function read<T>(path: string, parser: (value: unknown) => T, options: RequestInit): Promise<T> {
  const value: unknown = await adminRequest(path, options);
  try { return parser(value); } catch { throw new ApiError("交付工作台回應格式不正確，請重新整理。", { status: 502, code: "INVALID_RESPONSE" }); }
}
const path = (id: string) => `/art-deliveries/${encodeURIComponent(id)}`;
export const workspaceApi = {
  async list(query: WorkspaceQuery, signal: AbortSignal): Promise<DeliveryWorkspace> {
    try {
      return await read(queryPath("/art-deliveries/workspace", { ...query, pageSize: 20 }), (value) => {
        const row = object(value);
        return { items: parseDeliveries(row.items), totalCount: integer(row.totalCount), page: integer(row.page), pageSize: integer(row.pageSize),
          staff: list(row.staff, (item) => { const staff = object(item); return { id: string(staff.id), displayName: string(staff.displayName) }; }), available: true };
      }, { signal });
    } catch (cause) {
      // Compatibility is explicit; authentication, connection and malformed responses never become an empty success.
      if (!(cause instanceof ApiError) || (cause.status !== 404 && cause.code !== "DELIVERY_WORKSPACE_UNAVAILABLE")) throw cause;
      const items = await customerApi.deliveries(query, signal);
      return { items, totalCount: null, page: query.page, pageSize: 30, staff: [], available: false };
    }
  },
  assign: (id: string, version: number, staffMemberId: string | null, signal: AbortSignal) => read(`${path(id)}/assignment`, parseDelivery, { method: "PUT", body: JSON.stringify({ version, staffMemberId }), signal }),
  notify: (id: string, version: number, signal: AbortSignal) => read(`${path(id)}/notify`, parseDelivery, { method: "POST", body: JSON.stringify({ version }), signal }),
  viewCode: (id: string, signal: AbortSignal) => read(`${path(id)}/view-code`, (value) => string(object(value).claimCode), { method: "POST", signal }),
  history: (id: string, signal: AbortSignal) => read(`${path(id)}/history`, (value) => list<DeliveryHistory>(value, (item) => {
    const row = object(item);
    return { id: string(row.id), action: string(row.action), actorName: row.actorName === null ? null : string(row.actorName), createdAt: string(row.createdAt) };
  }), { signal }),
};
