"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminToggle } from "@/features/admin/shared/AdminShared.jsx";
import { formatClock, periodStatusLabel } from "./operationsFormat";
import { errorText, integer, list, record, textValue } from "./workbenchApi";
type Attendance = { hasOpenShift: boolean; stopped: boolean; startsAt: string; activeCount: number };

export function WorkbenchShiftBar({ businessDate, staffId, name, periodStatus, disabled, onChanged }: {
  businessDate: string; staffId: string; name: string; periodStatus: string;
  disabled: boolean; onChanged: () => Promise<void>;
}) {
  const [summaryState, setSummary] = useState<(Attendance & { key: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const summary = summaryState?.key === `${businessDate}:${staffId}` ? summaryState : null;
  useEffect(() => {
    if (!businessDate || !staffId) return;
    const controller = new AbortController();
    adminApi.getAttendance(businessDate, controller.signal).then((value: unknown) => {
      const rows = list(record(value).staff, record);
      const row = rows.find((r) => r.staffId === staffId);
      if (!row) throw new Error("今天沒有可使用的核准班次。");
      if (typeof row.hasOpenShift !== "boolean" || typeof row.stopAcceptingNewOrders !== "boolean") throw new Error("出勤狀態格式異常。");
      const next = { key: `${businessDate}:${staffId}`, hasOpenShift: row.hasOpenShift, stopped: row.stopAcceptingNewOrders, startsAt: row.actualStart == null ? "" : textValue(row.actualStart), activeCount: integer(row.activeServiceCount) };
      if (!controller.signal.aborted) { setSummary(next); setError(""); }
    }).catch((e: unknown) => { if (!controller.signal.aborted) { setSummary(null); setError(errorText(e)); } });
    return () => controller.abort();
  }, [businessDate, staffId, revision]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!lock.current && document.visibilityState === "visible") setRevision((r) => r + 1); }, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const apply = async (action: string) => {
    if (lock.current || !summary) return;
    lock.current = true; setBusy(true); setActionError("");
    try {
      await adminApi.applyAttendance({ operationId: crypto.randomUUID(), businessDate, staffId, action });
      await onChanged();
    } catch (e) { setActionError(errorText(e)); }
    finally { lock.current = false; setBusy(false); setRevision((r) => r + 1); }
  };
  return <section className="dwShiftBar" aria-label="我的營業狀態">
    <div className="dwShiftIdentity"><span className={`dwDot${summary?.hasOpenShift ? " isActive" : ""}`} /><div><strong>{name} <small>{periodStatusLabel(periodStatus)}</small></strong><p>{!staffId ? "帳號尚未綁定店員" : summary ? summary.hasOpenShift ? `上班中 · ${formatClock(summary.startsAt)} 打卡` : "尚未上班打卡" : error || "讀取今日出勤…"}</p></div></div>
    <AdminToggle checked={Boolean(summary && !summary.stopped)} label="接受新指名" ariaLabel="接受新指名" disabled={disabled || busy || !summary} onChange={() => void apply(summary?.stopped ? "resume_orders" : "stop_orders")} />
    <AdminButton variant="secondary" disabled={disabled || busy || !summary || Boolean(summary.hasOpenShift && summary.activeCount)} onClick={() => void apply(summary?.hasOpenShift ? "clock_out" : "clock_in")}>{busy ? "處理中…" : summary?.hasOpenShift ? "下班打卡" : "上班打卡"}</AdminButton>
    {actionError && <p className="adminFormError" role="alert">{actionError}</p>}
  </section>;
}
