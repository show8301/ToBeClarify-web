"use client";

import { useEffect, useId, useRef, useState } from "react";
import { adminApi, ApiError } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { formatDateTime, intakeModeLabel } from "./operationsFormat";
import { errorText, record } from "./workbenchApi";
import type { OperationsContext } from "./operationsTypes";

export type ManagerBusinessAction =
  | { type: "intake"; intakeMode: "normal" | "coordination" | "staff_only" }
  | { type: "time" | "pause" | "resume" | "close" | "reopen" };

type ActionBody = {
  businessDate: string;
  expectedVersion: number;
  operationId: string;
  reason: string;
  action: "set_intake_mode" | "set_projected_close" | "close" | "reopen";
  intakeMode?: string;
  projectedCloseAt?: string;
};

type Props = {
  context: OperationsContext;
  action: ManagerBusinessAction;
  disabled: boolean;
  onClose: () => void;
  onCompleted: (message: string) => Promise<void>;
};

function taiwanInput(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 8 * 3600000).toISOString().slice(0, 16) : "";
}

export function ManagerBusinessActionDialog({ context, action, disabled, onClose, onCompleted }: Props) {
  // Keep the reviewed version; background refreshes must not silently approve a new one.
  const [reviewedContext] = useState(context);
  const [reason, setReason] = useState("");
  const [closeTime, setCloseTime] = useState(() => taiwanInput(context.projectedCloseAt || context.referenceEndsAt));
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState<ActionBody | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const formId = useId();
  useEffect(() => () => request.current?.abort(), []);

  const pauseAction = action.type === "pause" || action.type === "resume";
  const title = action.type === "intake" ? `切換為${intakeModeLabel(action.intakeMode)}` : {
    time: "調整預計關店時間", pause: "暫停全店新指名", resume: "解除全店新指名暫停",
    close: "確認實際關店", reopen: "誤關重開",
  }[action.type];
  const invalid = !pauseAction && !reason.trim()
    || action.type === "time" && (!closeTime || !Number.isFinite(Date.parse(`${closeTime}:00+08:00`)))
    || action.type === "pause" && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440);

  const adjustTime = (offset: number) => {
    const current = Date.parse(`${closeTime}:00+08:00`);
    if (Number.isFinite(current)) setCloseTime(taiwanInput(new Date(current + offset * 60000).toISOString()));
  };

  const save = async () => {
    if (lock.current || disabled || !retry && invalid) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      if (pauseAction) {
        await adminApi.pauseNomination(action.type === "pause" ? minutes : 0, controller.signal);
      } else {
        let body = retry;
        if (!body) {
          const latest = record(await adminApi.getOrderingContext(controller.signal));
          if (latest.referenceBusinessDate !== reviewedContext.referenceBusinessDate
            || latest.businessPeriodId !== reviewedContext.businessPeriodId
            || latest.version !== reviewedContext.version
            || typeof latest.version !== "number" || !Number.isSafeInteger(latest.version)) {
            throw new Error("營業狀態已變更，請關閉視窗並確認最新狀態後重新操作。");
          }
          const base = {
            businessDate: reviewedContext.referenceBusinessDate,
            expectedVersion: latest.version,
            operationId: crypto.randomUUID(),
            reason: reason.trim(),
          };
          if (action.type === "intake") body = { ...base, action: "set_intake_mode", intakeMode: action.intakeMode };
          else if (action.type === "time") body = { ...base, action: "set_projected_close", projectedCloseAt: `${closeTime}:00+08:00` };
          else if (action.type === "close" || action.type === "reopen") body = { ...base, action: action.type };
          else throw new Error("不支援的營運操作。");
        }
        setRetry(body);
        await adminApi.applyBusinessPeriodAction(body, controller.signal);
        setRetry(null);
      }
      await onCompleted(pauseAction
        ? action.type === "pause" ? `已暫停全店新指名 ${minutes} 分鐘，既有預約保留。` : "已解除全店新指名暫停。"
        : `${title}已完成。`);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) setRetry(null);
      setError(errorText(cause));
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <AdminDialog
      open
      title={title}
      description={`營業日 ${reviewedContext.referenceBusinessDate} · 時間以台灣時間為準。`}
      className="managerBusinessActionDialog"
      onClose={() => { if (!lock.current) onClose(); }}
      actions={<>
        <AdminButton variant="ghost" disabled={busy} onClick={onClose}>取消</AdminButton>
        <AdminButton type="submit" form={formId} variant={action.type === "close" ? "danger" : "primary"}
          disabled={disabled || busy || !retry && invalid}>
          {busy ? "處理中…" : retry ? "查回／重試同一筆操作" : "確認送出"}
        </AdminButton>
      </>}
    >
      <form id={formId} className="managerForm" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset className="managerFieldset managerForm" disabled={busy || Boolean(retry)}>
          {action.type === "time" && <>
            <p className="managerHint">目前預計關店：{formatDateTime(reviewedContext.projectedCloseAt || reviewedContext.referenceEndsAt)}</p>
            <div className="adminRoleDashboardQuickLinks">
              <AdminButton variant="secondary" onClick={() => adjustTime(-30)}>提早 30 分鐘</AdminButton>
              <AdminButton variant="secondary" onClick={() => adjustTime(30)}>延後 30 分鐘</AdminButton>
            </div>
            <AdminField label="新預計關店時間" required>
              <input required type="datetime-local" value={closeTime} onChange={(event) => setCloseTime(event.target.value)} />
            </AdminField>
            {reviewedContext.latestCommittedBusyUntil && <p className="managerHint">已成立服務最晚占用至 {formatDateTime(reviewedContext.latestCommittedBusyUntil)}。</p>}
          </>}
          {action.type === "pause" && <AdminField label="暫停分鐘數" required>
            <input required type="number" min={1} max={1440} step={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
          </AdminField>}
          {pauseAction && <p className="managerHint">只調整全店是否接受新指名，既有預約與正在進行的服務保留。</p>}
          {action.type === "close" && <p>確認後停止顧客建立新訂單，既有訂單仍可查閱；後續請繼續核對帳款、工時與正式結算。</p>}
          {action.type === "reopen" && <p>重新開放此營業日，接單模式依 API 回傳狀態更新。</p>}
          {!pauseAction && <AdminField label="操作原因" required>
            <textarea required rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </AdminField>}
        </fieldset>
        {error && <p className="adminFormError" role="alert">{error}</p>}
        {retry && <p className="managerHint">請求已保留原操作編號。結果尚未確認時，請查回同一筆操作。</p>}
      </form>
    </AdminDialog>
  );
}
