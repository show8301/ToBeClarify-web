"use client";

import { useEffect, useRef, useState } from "react";
import { notificationRequest, NotificationApiError } from "@/features/admin/notifications/api";
import type { BroadcastSendRequest, BroadcastReceiptSummary } from "@/features/admin/notifications/types";
import { AdminButton, AdminDialog, AdminField, AdminPanel, AdminToggle } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { errorText, integer, list, record, textValue } from "./workbenchApi";

type Sound = { id: string; name: string };
function parseReceipt(value: unknown): BroadcastReceiptSummary {
  const r = record(value);
  return { broadcastId: textValue(r.broadcastId), recipientCount: integer(r.recipientCount), unreadCount: integer(r.unreadCount),
    readCount: integer(r.readCount), acknowledgedCount: integer(r.acknowledgedCount), pendingAcknowledgementCount: integer(r.pendingAcknowledgementCount),
    expiredUnacknowledgedCount: integer(r.expiredUnacknowledgedCount), withdrawnCount: integer(r.withdrawnCount) };
}

export function ManagerBroadcastPanel({ disabled, navigate }: { disabled: boolean; navigate: (route: string) => void }) {
  const [open, setOpen] = useState(false);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [soundId, setSoundId] = useState("");
  const [audience, setAudience] = useState<"all" | "working_today">("working_today");
  const [emergency, setEmergency] = useState(false);
  const [requiresAck, setRequiresAck] = useState(false);
  const [expires, setExpires] = useState(15);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [broadcastId, setBroadcastId] = useState("");
  const [receipt, setReceipt] = useState<BroadcastReceiptSummary | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pending = useRef<BroadcastSendRequest | null>(null);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void Promise.all([notificationRequest<unknown>("/sounds", undefined, { signal: controller.signal }), notificationRequest<unknown>("/capabilities", undefined, { signal: controller.signal })])
      .then(([value, capabilities]) => {
        if (record(capabilities).enabled !== true) throw new Error("通知服務目前未啟用。");
        const items = list(value, (entry) => {
          const s = record(entry);
          return { id: textValue(s.id), name: textValue(s.name), system: typeof s.systemCode === "string" && Boolean(s.systemCode), active: s.isActive !== false };
        }).filter((s) => s.system && s.active);
        if (!controller.signal.aborted) { setSounds(items); setReady(true); }
      }).catch((e: unknown) => { if (!controller.signal.aborted) { setReady(false); setError(errorText(e)); } });
    return () => controller.abort();
  }, [open]);

  const send = async () => {
    if (lock.current || disabled || !ready) return;
    const audienceLabel = audience === "working_today" ? "目前上班人員" : "全店人員";
    if (emergency && !pending.current && !window.confirm(`緊急廣播將通知${audienceLabel}，要求逐人確認。確定發送？`)) return;
    lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    try {
      pending.current ??= { idempotencyKey: crypto.randomUUID(), title: title.trim(), message: message.trim(), reason: reason.trim(),
        audienceMode: audience, audienceStaffIds: [],
        audienceRoles: [], priority: emergency ? "high" : "normal", expiresAfterMinutes: expires,
        soundId, action: "open_notifications", requiresAck: emergency || requiresAck, emergency };
      const result = record(await notificationRequest<unknown>("/broadcasts/send", pending.current, { method: "POST", signal: controller.signal }));
      const id = textValue(result.broadcastId), count = integer(result.recipientCount);
      pending.current = null;
      setBroadcastId(id); setReceipt(null); setRetrying(false); setFeedback(`廣播已排入發送，共 ${count} 位收件者。`);
      setTitle(""); setMessage(""); setReason(""); setOpen(false); setReady(false);
    } catch (e) {
      if (e instanceof NotificationApiError && e.status >= 400 && e.status < 500) pending.current = null;
      if (!controller.signal.aborted) { setError(errorText(e)); setRetrying(Boolean(pending.current)); }
    } finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  };

  const inspect = async (withdraw = false) => {
    if (lock.current || !broadcastId || disabled) return;
    if (withdraw && !window.confirm("確認撤回這筆廣播？尚未確認的廣播將解除阻擋。")) return;
    lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    try {
      if (withdraw) await notificationRequest("/broadcasts/withdraw", { broadcastId }, { method: "POST", signal: controller.signal });
      const next = parseReceipt(await notificationRequest<unknown>(`/broadcasts/receipts?broadcastId=${encodeURIComponent(broadcastId)}`, undefined, { signal: controller.signal }));
      if (next.broadcastId !== broadcastId) throw new Error("廣播確認進度與查詢不符。");
      setReceipt(next);
      if (withdraw) setFeedback("廣播已撤回。");
    } catch (e) { if (!controller.signal.aborted) setError(errorText(e)); }
    finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  };

  const invalid = !title.trim() || !message.trim() || !soundId || emergency && !reason.trim()
    || !Number.isInteger(expires) || expires < 1 || expires > 1440;
  return <AdminPanel className="managerBroadcastPanel" title={<span className="adminFieldHeading">店內廣播<AdminHelp title="店內廣播說明">可選擇通知全店人員或送出當下的上班人員；需要逐人確認時預設選上班人員。緊急廣播要求每位收件者按「已知道」。</AdminHelp></span>} actions={<><AdminButton disabled={disabled || busy} onClick={() => { setError(""); setReady(false); setOpen(true); }}>發送廣播</AdminButton><AdminButton variant="ghost" onClick={() => navigate("/admin/notifications")}>通知中心</AdminButton></>}>
    {feedback && <p role="status">{feedback}</p>}
    {broadcastId ? <div className="managerBroadcastReceipt"><div className="adminRoleDashboardQuickLinks"><AdminButton variant="secondary" disabled={busy || disabled} onClick={() => void inspect()}>查詢確認進度</AdminButton><AdminButton variant="danger" disabled={busy || disabled} onClick={() => void inspect(true)}>撤回最近廣播</AdminButton></div>
      {receipt && <p>收件 {receipt.recipientCount} · 已讀 {receipt.readCount} · 已知道 {receipt.acknowledgedCount} · 待確認 {receipt.pendingAcknowledgementCount} · 到期未確認 {receipt.expiredUnacknowledgedCount} · 撤回 {receipt.withdrawnCount}</p>}</div> : <p className="managerHint">尚未從本工作台發送廣播。</p>}
    {!open && error && <p className="adminFormError" role="alert">{error}</p>}
    <AdminDialog open={open} title="快速店內廣播" description="上班人員依送出當下的核准班次判定；全店人員包含所有有效後台帳號。" onClose={() => { if (!lock.current) { setOpen(false); setReady(false); } }} actions={null}>
      <form className="managerForm" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <fieldset className="managerFieldset managerForm" disabled={busy || retrying}>
          <AdminField label="標題" required><input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></AdminField>
          <AdminField label="內容" required><textarea required rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} /></AdminField>
          <AdminField label="通知對象"><select value={audience} onChange={(e) => { if (e.target.value === "all" || e.target.value === "working_today") setAudience(e.target.value); }}><option value="working_today">上班人員</option><option value="all">全店人員</option></select></AdminField>
          <AdminToggle label="緊急廣播（需逐人確認）" ariaLabel="緊急廣播需逐人確認" checked={emergency} onChange={(checked: boolean) => { setEmergency(checked); if (checked) setAudience("working_today"); }} />
          {emergency ? <AdminField label="緊急原因" required><textarea required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></AdminField> : <>
            <AdminToggle label="要求收件者按已知道" ariaLabel="要求廣播收件者按已知道" checked={requiresAck} onChange={(checked: boolean) => { setRequiresAck(checked); if (checked) setAudience("working_today"); }} />
          </>}
          <div className="managerTwoColumns"><AdminField label="有效期（分鐘）"><input type="number" required min={1} max={1440} step={1} value={expires} onChange={(e) => setExpires(Number(e.target.value))} /></AdminField><AdminField label="系統音效" required><select required value={soundId} onChange={(e) => setSoundId(e.target.value)}><option value="">選擇系統音效</option>{sounds.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></AdminField></div>
        </fieldset>
        {!ready && !error && <p role="status">讀取廣播設定…</p>}
        {error && <p className="adminFormError" role="alert">{error}</p>}
        {retrying && <p className="managerHint">結果尚未確認；草稿已鎖定，重試會沿用同一發送編號。</p>}
        <AdminButton type="submit" disabled={busy || disabled || !ready || !retrying && invalid}>{busy ? "處理中…" : retrying ? "查回／重試同一筆廣播" : "確認發送"}</AdminButton>
      </form>
    </AdminDialog>
  </AdminPanel>;
}
