"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { formatClock, periodStatusLabel } from "./operationsFormat";
import { errorText, integer, list, record, textValue } from "./workbenchApi";
type Attendance = { hasPlan: boolean; hasOpenShift: boolean; stopped: boolean; startsAt: string; activeCount: number };

type Props = {
  businessDate: string; staffId: string; name: string; periodStatus: string;
  disabled: boolean; onChanged: () => Promise<void>;
};

export function WorkbenchShiftBar(props: Props) {
  return <ShiftBar key={`${props.businessDate}:${props.staffId}`} {...props} />;
}

function ShiftBar({ businessDate, staffId, name, periodStatus, disabled, onChanged }: Props) {
  const [summaryState, setSummary] = useState<(Attendance & { key: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const mutationRequest = useRef<AbortController | null>(null);
  const summary = summaryState?.key === `${businessDate}:${staffId}` ? summaryState : null;
  useEffect(() => {
    if (!businessDate || !staffId) return;
    const controller = new AbortController();
    adminApi.getAttendance(businessDate, controller.signal).then((value: unknown) => {
      const payload = record(value);
      if (!Array.isArray(payload.staff)) throw new Error("出勤資料格式異常，請重新整理。");
      const rows = list(payload.staff, record);
      if (rows.some((row) => typeof row.staffId !== "string" || !row.staffId)) throw new Error("出勤人員資料不完整，請重新整理。");
      const row = rows.find((r) => r.staffId === staffId);
      if (!row) {
        if (!controller.signal.aborted) {
          setSummary({ key: `${businessDate}:${staffId}`, hasPlan: false, hasOpenShift: false, stopped: false, startsAt: "", activeCount: 0 });
          setError("");
        }
        return;
      }
      if (typeof row.hasOpenShift !== "boolean" || typeof row.stopAcceptingNewOrders !== "boolean") throw new Error("出勤狀態格式異常。");
      const next = { key: `${businessDate}:${staffId}`, hasPlan: true, hasOpenShift: row.hasOpenShift, stopped: row.stopAcceptingNewOrders, startsAt: row.actualStart == null ? "" : textValue(row.actualStart), activeCount: integer(row.activeServiceCount) };
      if (!controller.signal.aborted) { setSummary(next); setError(""); }
    }).catch((e: unknown) => { if (!controller.signal.aborted) { setSummary(null); setError(errorText(e)); } });
    return () => controller.abort();
  }, [businessDate, staffId, revision]);
  useEffect(() => () => mutationRequest.current?.abort(), []);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!lock.current && document.visibilityState === "visible") setRevision((r) => r + 1); }, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const apply = async (action: string) => {
    if (lock.current || !summary?.hasPlan) return;
    const controller = new AbortController();
    mutationRequest.current = controller;
    lock.current = true; setBusy(true); setActionError("");
    try {
      await adminApi.applyAttendance({ operationId: crypto.randomUUID(), businessDate, staffId, action }, controller.signal);
      if (controller.signal.aborted) return;
      await onChanged();
    } catch (e) { if (!controller.signal.aborted) setActionError(errorText(e)); }
    finally {
      lock.current = false;
      if (mutationRequest.current === controller) mutationRequest.current = null;
      if (!controller.signal.aborted) { setBusy(false); setRevision((r) => r + 1); }
    }
  };
  return <section className="dwShiftBar" aria-label="我的營業狀態">
    <div className="dwShiftIdentity"><span className={`dwDot${summary?.hasOpenShift ? " isActive" : ""}`} /><div><strong>{name} <small>{periodStatusLabel(periodStatus)}</small></strong><p>{!staffId ? "帳號尚未綁定店員" : summary ? !summary.hasPlan ? "今日尚無核准班次，可查看工作台" : summary.hasOpenShift ? `上班中 · ${formatClock(summary.startsAt)} 打卡` : "尚未上班打卡" : error || "讀取今日出勤…"}</p></div></div>
    <AdminButton variant="secondary" busy={busy} busyLabel="處理中…" disabled={disabled || !summary?.hasPlan || Boolean(summary.hasOpenShift && summary.activeCount)} disabledReason={summary && !summary.hasPlan ? "請先完成班次規劃並由經理核准。" : undefined} onClick={() => void apply(summary?.hasOpenShift ? "clock_out" : "clock_in")}>{summary?.hasOpenShift ? "下班打卡" : "上班打卡"}</AdminButton>
    {actionError && <p className="adminFormError" role="alert">{actionError}</p>}
  </section>;
}
