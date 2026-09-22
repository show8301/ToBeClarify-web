import type { ArtDelivery, CustomerDetail, CustomerHistoryOrder, CustomerHistoryPage, CustomerIdentityCandidate, CustomerIdentityCandidates, CustomerProfile, CustomerVisit, DeliveryAsset, DeliveryIssued } from "./types";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid string");
  return value;
}
function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("Invalid number");
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid boolean");
  return value;
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Invalid array");
  return value.map(parse);
}
function profile(value: unknown): CustomerProfile {
  const data = object(value);
  return { uid: string(data.uid), displayName: string(data.displayName), createdAt: string(data.createdAt) };
}
export function parseCustomerProfile(value: unknown): CustomerProfile {
  return profile(value);
}
function historyOrder(value: unknown): CustomerHistoryOrder {
  const data = object(value);
  return { id: string(data.id), orderNumber: string(data.orderNumber), status: string(data.status), totalAmount: number(data.totalAmount) };
}
function visit(value: unknown): CustomerVisit {
  const data = object(value);
  return {
    sessionId: string(data.sessionId), customerUid: nullableString(data.customerUid), gameId: string(data.gameId),
    customerName: string(data.customerName), businessDate: string(data.businessDate), businessPeriodId: nullableString(data.businessPeriodId),
    sessionStatus: string(data.sessionStatus), entryStatus: string(data.entryStatus), createdAt: string(data.createdAt),
    recoveryCodeIssuedAt: nullableString(data.recoveryCodeIssuedAt), recoveryCodeVersion: number(data.recoveryCodeVersion),
    hasRecoveryCode: boolean(data.hasRecoveryCode),
    orderCount: number(data.orderCount), orderAmount: number(data.orderAmount), netReceived: number(data.netReceived),
    hasCashRecords: boolean(data.hasCashRecords), pendingDeliveryCount: number(data.pendingDeliveryCount),
    gameIdVisitCount: number(data.gameIdVisitCount), gameIdOrderAmount: number(data.gameIdOrderAmount), orders: array(data.orders, historyOrder),
  };
}
export function parseHistory(value: unknown): CustomerHistoryPage {
  const data = object(value);
  return { page: number(data.page), pageSize: number(data.pageSize), totalCount: number(data.totalCount), items: array(data.items, visit) };
}
export function parseCustomerDetail(value: unknown): CustomerDetail {
  const data = object(value);
  const summary = object(data.summary);
  return {
    profile: profile(data.profile),
    summary: { visitCount: number(summary.visitCount), orderCount: number(summary.orderCount), orderAmount: number(summary.orderAmount), netReceived: number(summary.netReceived), pendingDeliveryCount: number(summary.pendingDeliveryCount) },
    visits: array(data.visits, visit),
  };
}
function identityCandidate(value: unknown): CustomerIdentityCandidate {
  const data = object(value);
  return {
    uid: string(data.uid), displayName: string(data.displayName), createdAt: string(data.createdAt),
    lastVisitAt: nullableString(data.lastVisitAt), visitCount: number(data.visitCount),
    orderCount: number(data.orderCount), orderAmount: number(data.orderAmount),
  };
}
export function parseIdentityCandidates(value: unknown): CustomerIdentityCandidates {
  const data = object(value);
  return { gameId: string(data.gameId), items: array(data.items, identityCandidate) };
}
function asset(value: unknown): DeliveryAsset {
  const data = object(value);
  return { id: string(data.id), kind: string(data.kind), label: string(data.label), url: nullableString(data.url), contentType: nullableString(data.contentType), byteSize: number(data.byteSize), createdAt: string(data.createdAt) };
}
export function parseDelivery(value: unknown): ArtDelivery {
  const data = object(value);
  return {
    id: string(data.id), sessionId: string(data.sessionId), customerUid: nullableString(data.customerUid),
    gameId: string(data.gameId), customerName: string(data.customerName), businessDate: string(data.businessDate),
    orderId: nullableString(data.orderId), orderNumber: nullableString(data.orderNumber), orderItemId: nullableString(data.orderItemId),
    title: string(data.title), description: nullableString(data.description), status: string(data.status),
    dueDate: nullableString(data.dueDate), version: number(data.version), createdAt: string(data.createdAt),
    updatedAt: string(data.updatedAt), deliveredAt: nullableString(data.deliveredAt), assets: array(data.assets, asset),
  };
}
export function parseDeliveries(value: unknown): ArtDelivery[] { return array(value, parseDelivery); }
export function parseDeliveryIssued(value: unknown): DeliveryIssued {
  const data = object(value);
  return { delivery: parseDelivery(data.delivery), claimCode: string(data.claimCode) };
}
