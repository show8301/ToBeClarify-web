"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminToggle } from "@/features/admin/shared/AdminShared.jsx";
import { isRecord } from "./operationsFormat";
import { parseStaffDailyWorkMode, workRoleOptions } from "./staffWorkStatus";
import type { OperationsStaffMember, WorkRole } from "./operationsTypes";

type Props = {
  staff: OperationsStaffMember;
  disabled: boolean;
  onChanged: () => Promise<void>;
};

type Change = { kind: "intake"; enabled: boolean } | { kind: "role"; role: WorkRole; enabled: boolean };

export function StaffWorkStatusPanel({ staff, disabled, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const mode = staff.todayWorkMode;
  const unavailable = disabled || busy || !mode;

  useEffect(() => () => requestRef.current?.abort(), []);

  const apply = async (change: Change) => {
    if (unavailable || !mode || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Read current roles before writing: the work-mode endpoint replaces both arrays.
      const latest: unknown = await adminApi.getStaffMember(staff.id, controller.signal);
      const current = parseStaffDailyWorkMode(latest);
      if (!isRecord(latest) || latest.id !== staff.id || !current) {
        throw new Error("工作狀態資料不完整，請重新整理後再操作。");
      }
      if (current.businessDate !== mode.businessDate) {
        throw new Error("營業日已變更，請確認更新後的日期再操作。");
      }
      const roles = new Set(current.activeRoles);
      if (change.kind === "role") {
        if (!current.isWorking || !current.scheduledRoles.includes(change.role)) {
          throw new Error("目前未在核准值班時段內，或此職位未列入排班；請先確認值班規劃。");
        }
        if (change.enabled) roles.add(change.role);
        else roles.delete(change.role);
      }
      const saved: unknown = await adminApi.updateStaffDailyWorkMode(staff.id, {
        stopAcceptingNewOrders: change.kind === "intake" ? !change.enabled : current.stopAcceptingNewOrders,
        scheduledRoles: current.scheduledRoles,
        activeRoles: [...roles],
      }, controller.signal);
      if (!isRecord(saved) || saved.id !== staff.id || !parseStaffDailyWorkMode(saved)) {
        throw new Error("已送出工作狀態調整，但無法確認回傳資料，請重新整理確認結果。");
      }
      if (!controller.signal.aborted) {
        setMessage(change.kind === "intake" ? (change.enabled ? "已恢復接受新指名。" : "已暫停接受新指名，既有預約保留。") : "本班工作職位已更新。");
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "更新工作狀態失敗。");
    } finally {
      if (!controller.signal.aborted) {
        // Also refresh after an uncertain result; never automatically resend a mutation.
        try {
          await onChanged();
        } catch {
          if (!controller.signal.aborted) setError("無法重新讀取工作狀態，請重新整理確認結果。");
        } finally {
          if (!controller.signal.aborted) {
            requestRef.current = null;
            setBusy(false);
          }
        }
      }
    }
  };

  return <div className="adminWorkStatus" aria-busy={busy}>
    <div className="adminWorkStatusSummary">
      <strong>營業日 {mode?.businessDate || "尚無資料"} · {staff.isWorkingToday ? "執勤中" : "未執勤"}</strong>
      <span>核准班次：{staff.todayShift || "無核准上班時段"}</span>
    </div>
    <div className="adminWorkStatusIntake">
      <AdminToggle
        checked={Boolean(mode && !mode.stopAcceptingNewOrders)}
        disabled={unavailable}
        label="接受新指名"
        ariaLabel={`${staff.displayName}接受新指名`}
        onChange={(enabled: boolean) => void apply({ kind: "intake", enabled })}
      />
      <small>關閉只暫停新指名，既有預約保留；接單仍須符合核准班表與公開指名資格。</small>
      {!staff.isActive && <small>此店員的公開卡片已隱藏；當班開關不會自動公開卡片或開放指名。</small>}
    </div>
    <fieldset className="adminWorkStatusRoles" disabled={unavailable || !mode?.isWorking}>
      <legend>本班工作職位</legend>
      <div className="adminWorkStatusOptions">
        {workRoleOptions.map((option) => {
          const allowed = mode?.scheduledRoles.includes(option.id) === true;
          return <div className="adminWorkStatusOption" key={option.id}>
            <AdminToggle
              checked={mode?.activeRoles.includes(option.id) === true}
              disabled={unavailable || !mode?.isWorking || !allowed}
              label={option.label}
              ariaLabel={`${staff.displayName}本班啟用${option.label}`}
              onChange={(enabled: boolean) => void apply({ kind: "role", role: option.id, enabled })}
            />
            <small>{allowed ? "已列入排班" : "未列入排班"}</small>
          </div>;
        })}
      </div>
    </fieldset>
    <p className="adminWorkStatusHint">排班允許職位由<a href="/admin/duty-planning">值班規劃</a>管理；這裡只調整本班啟用職位與職位廣播受眾，不會變更執勤、打卡或帳號權限。提前下班請調整班表並完成打卡。</p>
    {!mode && <p className="adminFormError" role="alert">工作狀態暫無法確認，請重新整理。</p>}
    {busy && <p role="status">工作狀態更新中…</p>}
    {error && <p className="adminFormError" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
