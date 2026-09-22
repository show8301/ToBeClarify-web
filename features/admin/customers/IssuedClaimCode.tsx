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
  const [copied, setCopied] = useState(false);

  async function copy(valueToCopy: string) {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(valueToCopy);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <AdminPanel title={title} description="請將此單筆領取碼私下交給顧客；離開後不能從系統還原。">
    <div className="adminClaimCodeReveal">
      <code>{value}</code>
      <div className="adminCustomerActions">
        <button type="button" className="adminButton adminButton-primary" onClick={() => void copy(value)}>{copied ? "已複製" : "複製領取碼"}</button>
        {collectionLink ? <button type="button" className="adminButton adminButton-secondary" onClick={() => void copy(`${window.location.origin}/collection#code=${encodeURIComponent(value)}`)}>複製作品領取連結</button> : null}
        <button type="button" className="adminButton adminButton-ghost" onClick={onClose}>關閉</button>
      </div>
    </div>
  </AdminPanel>;
}
