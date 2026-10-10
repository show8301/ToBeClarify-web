"use client";

import { useState } from "react";
import { AdminPanel } from "@/features/admin/shared/AdminShared.jsx";

type Props = {
  title: string;
  value: string;
  collectionLink?: boolean;
  onClose: () => void;
};

export function IssuedClaimCode({ title, value, collectionLink = false, onClose }: Props) {
  const [feedback, setFeedback] = useState("");

  async function copy(valueToCopy: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("此瀏覽器無法自動複製，請選取領取碼手動複製。");
      await navigator.clipboard.writeText(valueToCopy);
      setFeedback("已複製。");
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : "複製失敗，請手動複製。"); }
  }

  return <AdminPanel title={title} description="請將此單筆領取碼私下交給顧客保存。">
    <div className="adminClaimCodeReveal">
      <code>{value}</code>
      <div className="adminCustomerActions">
        <button type="button" className="adminButton adminButton-primary" onClick={() => void copy(value)}>複製領取碼</button>
        {collectionLink ? <button type="button" className="adminButton adminButton-secondary" onClick={() => void copy(`${window.location.origin}/collection#code=${encodeURIComponent(value)}`)}>複製作品領取連結</button> : null}
        <button type="button" className="adminButton adminButton-ghost" onClick={onClose}>關閉</button>
      </div>
      {feedback ? <p role="status">{feedback}</p> : null}
    </div>
  </AdminPanel>;
}
