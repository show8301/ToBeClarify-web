"use client";

import { useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { financeApi } from "@/features/admin/orders/finance-api";
import { AdminButton, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { CreateDeliveryPanel } from "@/features/admin/deliveries/CreateDeliveryPanel";
import { errorText, record, textValue } from "./workbenchApi";
import type { DeliveryIssued } from "@/features/admin/customers/types";
import type { CurrentAdminUser, OperationsSession } from "./operationsTypes";

function ShareFields({ fields }: { fields: Array<{ label: string; value: string }> }) {
  const [feedback, setFeedback] = useState("");
  const copy = async (value: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("請選取欄位內容手動複製。");
      await navigator.clipboard.writeText(value); setFeedback("已複製，可貼給顧客。");
    } catch (e) { setFeedback(errorText(e)); }
  };
  return <div className="dwForm">{fields.map((field) => <div className="dwShareField" key={field.label}><AdminField label={field.label}><textarea readOnly rows={field.value.includes("\n") ? 4 : 2} value={field.value} onFocus={(e) => e.currentTarget.select()} /></AdminField><AdminButton variant="secondary" onClick={() => void copy(field.value)}>複製{field.label}</AdminButton></div>)}{feedback && <p role="status">{feedback}</p>}</div>;
}

export function WorkbenchPassAction({ session, onChanged, onBusy }: { session: OperationsSession; onChanged: () => Promise<void>; onBusy: (busy: boolean) => void }) {
  const [issued, setIssued] = useState<{ url: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const reissue = async () => {
    if (lock.current || issued) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      const result = record(await adminApi.reissueOrderSession(session.id));
      const original = new URL(textValue(result.orderUrl), window.location.origin);
      if (original.pathname !== "/order") throw new Error("點餐連結格式異常，請重新整理確認。");
      const url = new URL(original.pathname + original.search + original.hash, window.location.origin).toString();
      setIssued({ url, code: textValue(result.recoveryCode) });
      await onChanged();
    } catch (e) { setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <div className="dwForm">
    {issued ? <><p className="dwNotice" role="status">新點餐資料已建立，請當場交給 {session.customerName}。</p><ShareFields fields={[{ label: "點餐連結", value: issued.url }, { label: "恢復碼", value: issued.code }, { label: "分享文字", value: `${session.customerName}，您的點餐連結：\n${issued.url}\n恢復碼：${issued.code}` }]} /></> : <><p className="dwNotice">重發後，原點餐連結與恢復碼會失效。請確認顧客可以收到新資料。</p><AdminButton disabled={busy} onClick={() => void reissue()}>{busy ? "重發中…" : "確認重發點餐碼"}</AdminButton></>}
    {error && <p className="adminFormError" role="alert">{error} 若連線中斷，請先確認顧客目前的點餐資料。</p>}
  </div>;
}

export function WorkbenchDeliveryAction({ session, orderId, businessDate, user, onBusy, onDirty }: {
  session: OperationsSession; orderId: string; businessDate: string; user: CurrentAdminUser;
  onBusy: (busy: boolean) => void; onDirty: (dirty: boolean) => void;
}) {
  const [issued, setIssued] = useState<DeliveryIssued | null>(null);
  if (issued) {
    const link = `${window.location.origin}/collection#code=${encodeURIComponent(issued.claimCode)}`;
    return <><p className="dwNotice" role="status">「{issued.delivery.title}」委託已建立，作品完成後再通知顧客。</p><ShareFields fields={[{ label: "領取碼", value: issued.claimCode }, { label: "領取連結", value: link }, { label: "分享文字", value: `您的「${issued.delivery.title}」委託已建立，作品完成後會再通知您。\n領取碼：${issued.claimCode}\n領取連結：${link}` }]} /></>;
  }
  return <CreateDeliveryPanel sessionId={session.id} orderId={orderId} businessDate={businessDate} staff={[{ id: user.staffMemberId, displayName: user.displayName }]} defaultStaffId={user.staffMemberId} available showSourceLink={false} lockOwner onBusy={onBusy} onDirty={onDirty} onIssued={(value) => { setIssued(value); onDirty(false); onBusy(false); }} />;
}

export function WorkbenchDepartureAction({ session, onSaved, onBusy }: { session: OperationsSession; onSaved: () => Promise<void>; onBusy: (busy: boolean) => void }) {
  const departed = session.entryStatus === "departed" || session.status === "readonly";
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const operationId = useRef("");
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      operationId.current ||= crypto.randomUUID();
      await financeApi.departure(session.id, { operationId: operationId.current, action: departed ? "reopen" : "depart", reason: reason.trim() });
      await onSaved();
    } catch (e) { setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <form className="dwForm" onSubmit={(e) => { e.preventDefault(); void save(); }}><p className="dwNotice">{departed ? "重新開放後，顧客可以在目前營業期內繼續點餐。" : "標記離店後，保留訂單並停止顧客繼續點餐。"}</p><AdminField label="原因" required><textarea required rows={3} maxLength={500} disabled={busy} value={reason} onChange={(e) => { setReason(e.target.value); operationId.current = ""; }} /></AdminField>{error && <p className="adminFormError" role="alert">{error}</p>}<AdminButton type="submit" disabled={busy || !reason.trim()}>{busy ? "處理中…" : departed ? "重新開放點餐" : "確認顧客離店"}</AdminButton></form>;
}
