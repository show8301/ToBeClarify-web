"use client";
import { useEffect, useState } from "react";
import { AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { customerApi } from "@/features/admin/customers/api";
import { queryPath } from "@/features/admin/customers/presentation";
import { useCustomerMutation } from "@/features/admin/customers/useCustomerMutation";
import type { DeliveryIssued } from "@/features/admin/customers/types";
import type { DeliveryStaff } from "./workspaceApi";
type Props = { sessionId: string; orderId: string; businessDate: string; staff: DeliveryStaff[]; defaultStaffId: string; available: boolean;
  onIssued: (value: DeliveryIssued) => void; onDirty: (value: boolean) => void; onBusy: (value: boolean) => void };
export function CreateDeliveryPanel({ sessionId, orderId, businessDate, staff, defaultStaffId, available, onIssued, onDirty, onBusy }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const defaultOwner = staff.some((person) => person.id === defaultStaffId) ? defaultStaffId : "";
  const [owner, setOwner] = useState(defaultOwner);
  const { busy, error, perform } = useCustomerMutation();
  const dirty = Boolean(title || description || dueDate || owner !== defaultOwner);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  return <form className="adminCustomerForm" onSubmit={(event) => { event.preventDefault(); void perform((signal) => customerApi.createDelivery({ sessionId, orderId: orderId || null, title: title.trim(), description: description.trim() || null, dueDate: dueDate || null, ...(available ? { assignedStaffId: owner || null } : {}) }, signal), onIssued); }}>
    <p className="adminCustomerHint">來源：{businessDate || "所選營業日"} 的入場紀錄{orderId ? "及指定訂單" : ""}。建立後會產生這筆委託的獨立領取碼。</p>
    <AdminField label="作品／服務名稱" required><input required maxLength={160} disabled={busy} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：雙人半身繪圖委託" /></AdminField>
    <AdminField label="顧客可見說明"><textarea rows={3} maxLength={2000} disabled={busy} value={description} onChange={(event) => setDescription(event.target.value)} /></AdminField>
    <AdminField label="預計交付日"><input type="date" disabled={busy} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></AdminField>
    {available ? <AdminField label="委託負責人"><select value={owner} disabled={busy} onChange={(event) => setOwner(event.target.value)}><option value="">尚未指派</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></AdminField> : null}
    {error ? <p className="adminCustomerFeedback isError" role="alert">{error} 若連線中斷，請先重整清單確認是否已建立，再處理領取碼。</p> : null}
    <div className="adminCustomerActions"><button type="submit" className="adminButton adminButton-primary" disabled={busy || !title.trim()}>{busy ? "建立中…" : "建立作品並產生領取碼"}</button><a className="adminButton adminButton-ghost" href={queryPath("/admin/order-list", { session: sessionId, date: businessDate, order: orderId })}>核對來源顧客</a></div>
  </form>;
}
