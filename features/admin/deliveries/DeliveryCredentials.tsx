"use client";

import { useEffect, useState } from "react";
import { AdminDialog } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { customerApi } from "@/features/admin/customers/api";
import { useCustomerMutation } from "@/features/admin/customers/useCustomerMutation";
import { workspaceApi } from "./workspaceApi";
import type { ArtDelivery, DeliveryIssued } from "@/features/admin/customers/types";

type Props = { delivery: ArtDelivery; canManage: boolean; initialCode: string | null; locked: boolean; onIssued: (value: DeliveryIssued) => void; onBusy: (value: boolean) => void };
export function DeliveryCredentials({ delivery, canManage, initialCode, locked, onIssued, onBusy }: Props) {
  const [code, setCode] = useState(initialCode || "");
  const [feedback, setFeedback] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const { busy, error, perform } = useCustomerMutation();
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);
  async function copy(kind: "code" | "link" | "message") {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("此瀏覽器無法自動複製，請選取領取碼手動複製。");
      const link = `${window.location.origin}/collection#code=${encodeURIComponent(code)}`;
      const message = `您的「${delivery.title}」${["ready", "delivered"].includes(delivery.status) ? "已開放領取" : "委託已建立，作品完成後會再通知您"}。\n單筆領取碼：${code}\n領取連結：${link}`;
      await navigator.clipboard.writeText(kind === "code" ? code : kind === "link" ? link : message);
      setFeedback("已複製。傳送給顧客後，再記錄已通知。");
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : "複製失敗，請手動複製。"); }
  }
  return <div className="adminDeliveryTabContent">
    <section className="adminDeliveryCredentialBox" aria-label="單筆領取資料">
      <h3>單筆領取資料</h3>
      <p className="adminCustomerHint">檢視及複製沿用目前領取碼。請私下交給這筆委託的顧客。</p>
      {code ? <><label className="adminField"><span>目前領取碼</span><input readOnly value={code} onFocus={(event) => event.target.select()} /></label>
        <div className="adminCustomerActions"><button type="button" className="adminButton adminButton-primary" onClick={() => void copy("code")}>複製領取碼</button><button type="button" className="adminButton adminButton-secondary" onClick={() => void copy("link")}>複製領取連結</button><button type="button" className="adminButton adminButton-secondary" onClick={() => void copy("message")}>複製交付文字</button><button type="button" className="adminButton adminButton-ghost" onClick={() => { setCode(""); setFeedback(""); }}>隱藏領取碼</button></div></> : <button type="button" className="adminButton adminButton-primary" disabled={busy || locked || !delivery.canViewClaimCode} onClick={() => void perform((signal) => workspaceApi.viewCode(delivery.id, signal), setCode)}>{busy ? "讀取中…" : "檢視目前領取碼"}</button>}
      {!delivery.canViewClaimCode && !code ? <p className="adminCustomerHint">{delivery.workspaceAvailable ? "這筆舊委託只保存了雜湊，原碼仍有效；店經理重發一次後，便可再次檢視新碼。" : "領取碼檢視服務尚未啟用。原有領取碼仍有效。"}</p> : null}
      {error ? <p className="adminCustomerFeedback isError" role="alert">{error}</p> : null}
      {feedback ? <p role="status" className="adminCustomerFeedback">{feedback}</p> : null}
    </section>
    <section className="adminDeliveryCredentialBox"><h3>顧客 UID</h3><p>{delivery.customerUid || "尚未歸戶"}</p><p className="adminCustomerHint">UID 可查看此顧客已綁定的所有作品；單筆委託請使用上方領取資料。</p></section>
    <details className="adminSettlementDisclosure"><AdminDisclosureSummary>領取碼維護</AdminDisclosureSummary><p className="adminCustomerHint">重發會讓舊領取碼及舊連結立即失效。</p>{canManage ? <button type="button" className="adminButton adminButton-ghost" disabled={busy || locked} onClick={() => setConfirmation(true)}>重發單筆領取碼</button> : <p>重發需由店經理處理。</p>}</details>
    <AdminDialog open={confirmation} title="重發單筆領取碼" description="舊碼及舊連結將立即失效。核對顧客後，請將新碼私下交給顧客。" onClose={() => { if (!busy) setConfirmation(false); }} actions={null}>
      {error ? <p role="alert">{error}</p> : null}<button type="button" className="adminButton adminButton-primary" disabled={busy} onClick={() => void perform((signal) => customerApi.reissueCode(delivery.id, signal), (value) => { setCode(value.claimCode); setConfirmation(false); setFeedback("已重發，舊碼已失效。"); onIssued(value); })}>{busy ? "處理中…" : "已核對，重發領取碼"}</button>
    </AdminDialog>
  </div>;
}
