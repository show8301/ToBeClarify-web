"use client";

import { useRef, useState } from "react";
import { adminRequest, ApiError } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { DeliveryItems } from "@/features/admin/shared/DeliveryItems";
import { completionOption } from "./workbenchOrderProgress";
import { errorText, fulfillmentPath } from "./workbenchApi";
import { formatClock } from "./operationsFormat";
import type { WorkbenchUnit } from "./workbenchApi";
import type { OperationsOrder } from "./operationsTypes";

type CompletionRequest = {
  operationId: string; expectedVersion: number; action: "complete" | "backfill";
  quantity: number; reason: string; actualStartsAt: string; actualEndsAt: string;
  restMinutes: number; compensationAmount: number;
};

export function WorkbenchItemCompletionDialog({ order, unit, onClose, onCommitted, onBusy }: {
  order: OperationsOrder; unit: WorkbenchUnit; onClose: () => void;
  onCommitted: (message: string) => void; onBusy: (busy: boolean) => void;
}) {
  const option = completionOption(unit);
  const label = unit.kind === "meal" ? "確認已送達" : "確認使用完成";
  const [quantity, setQuantity] = useState(option?.quantity ?? 1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<CompletionRequest | null>(null);
  const [mustReload, setMustReload] = useState(false);
  const [openedAt] = useState(Date.now);
  const lock = useRef(false);
  const early = unit.kind === "room" && Date.parse(unit.scheduledEndsAt) > openedAt;
  const save = async () => {
    if (lock.current || mustReload || !option || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > option.quantity || early && !reason.trim()) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    const now = new Date().toISOString();
    const roomStart = unit.actualStartsAt || unit.scheduledStartsAt;
    const body: CompletionRequest = retry ?? {
      operationId: crypto.randomUUID(), expectedVersion: unit.version, action: option.action, quantity,
      reason: reason.trim() || `指名工作台：${label}`,
      actualStartsAt: unit.kind === "room" && Date.parse(roomStart) <= Date.parse(now) ? roomStart : now,
      actualEndsAt: now,
      restMinutes: -1, compensationAmount: 0,
    };
    setRetry(body);
    try {
      await adminRequest(`${fulfillmentPath(order.id, unit.id)}/transition`, { method: "POST", body: JSON.stringify(body) });
      setRetry(null);
      onCommitted(`${unit.name} × ${body.quantity}：${unit.kind === "meal" ? "已確認送達" : "已確認使用完成"}。`);
    } catch (e: unknown) {
      setError(errorText(e));
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        setRetry(null); setMustReload(true);
      }
    } finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <AdminDialog open title={label} description={`${order.orderNumber} · ${unit.name}`} className="adminDesignatedWorkbenchDialog" onClose={() => { if (!busy && !retry) onClose(); }} actions={null}>
    <form className="dwOrderActionForm" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p>{unit.kind === "meal" ? "確認本次已實際送達的數量。" : "確認顧客已結束這段包廂使用。"}</p>
      {unit.kind === "meal" && <DeliveryItems items={unit.deliveryItems} />}
      {unit.kind === "room" && <p>預約時段：{formatClock(unit.scheduledStartsAt)}–{formatClock(unit.scheduledEndsAt)}</p>}
      <fieldset disabled={busy || Boolean(retry) || mustReload}>
        <AdminField label="本次完成數量" required><input type="number" min={1} max={option?.quantity ?? 1} step={1} required value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></AdminField>
        <AdminField label={early ? "提前結束原因" : "備註（選填）"} required={early}><textarea rows={2} maxLength={500} required={early} value={reason} onChange={(event) => setReason(event.target.value)} /></AdminField>
      </fieldset>
      {early && <p>包廂預約尚未結束，提前完成須填寫原因；費用依原訂單記錄。</p>}
      {error && <p className="adminFormError" role="alert">{error}</p>}
      {retry && !busy && <p role="status">操作結果尚未確認，請重試同一筆操作以查回結果。</p>}
      {mustReload && <p role="status">請關閉視窗並重新載入最新進度。</p>}
      <div className="dwActions">
        <AdminButton type="submit" disabled={busy || mustReload || !option}>{busy ? "處理中…" : retry ? "查回／重試同一筆操作" : label}</AdminButton>
        <AdminButton variant="ghost" disabled={busy || Boolean(retry)} onClick={onClose}>返回</AdminButton>
      </div>
    </form>
  </AdminDialog>;
}
