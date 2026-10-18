"use client";

import { useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";

type Props = {
  reasonId: string;
  loading: boolean;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
};

export function StoreConfirmationPanel({ reasonId, loading, onApprove, onReject }: Props) {
  const [reason, setReason] = useState("");

  return <div className="adminStoreConfirmation">
    <div>
      <strong>關店時段協調單</strong>
      <p>顧客已送出但尚未成立；可先取消未服務項目。接受後，指名與加購仍須由被指名店員確認。</p>
    </div>
    <label htmlFor={reasonId}>拒絕原因（拒絕時必填）
      <input id={reasonId} value={reason} maxLength={500} placeholder="拒絕時必填" disabled={loading}
        onChange={(event) => setReason(event.target.value)} />
    </label>
    <div>
      <AdminButton disabled={loading} onClick={() => { void onApprove(); }}>接受協調單</AdminButton>
      <AdminButton variant="danger" disabled={loading || !reason.trim()} onClick={() => { void onReject(reason.trim()); }}>
        拒絕協調單
      </AdminButton>
    </div>
  </div>;
}
