"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminToggle } from "@/features/admin/shared/AdminShared.jsx";
import { isRecord } from "./operationsFormat";
import { parseStaffDailyWorkMode, workRoleOptions } from "./staffWorkStatus";
import type { OperationsStaffMember, WorkRole } from "./operationsTypes";
import { payrollRoleLabel } from "@/features/admin/shared/workRoles";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";

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
      // Check the business date, then send only this change. The API applies it
      // under a lock without overwriting concurrent intake/support adjustments.
      const latest: unknown = await adminApi.getStaffMember(staff.id, controller.signal);
      const current = parseStaffDailyWorkMode(latest);
      if (!isRecord(latest) || latest.id !== staff.id || !current) {
        throw new Error("工作狀態資料不完整，請重新整理後再操作。");
      }
      if (current.businessDate !== mode.businessDate) {
        throw new Error("營業日已變更，請確認更新後的日期再操作。");
      }
      if (change.kind === "role") {
        if (!current.isWorking || (change.enabled && !current.allowedSupportRoles.includes(change.role))) {
          throw new Error("目前不在核准班次內，或尚未具備此支援工作資格。");
        }
      }
      const saved: unknown = await adminApi.updateStaffDailyWorkMode(staff.id, {
        businessDate: current.businessDate,
        ...(change.kind === "intake" ? { stopAcceptingNewOrders: !change.enabled }
          : { supportRole: change.role, supportEnabled: change.enabled }),
      }, controller.signal);
      if (!isRecord(saved) || saved.id !== staff.id || !parseStaffDailyWorkMode(saved)) {
        throw new Error("已送出工作狀態調整，但無法確認回傳資料，請重新整理確認結果。");
      }
      if (!controller.signal.aborted) {
        setMessage(change.kind === "intake" ? (change.enabled ? "已恢復接受新指名。" : "已暫停接受新指名，既有預約保留。") : "目前支援工作與職位廣播受眾已更新；計薪職位不變。");
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
      <span className="adminFieldHeading">本班計薪職位：{payrollRoleLabel(mode?.payrollRole || null)}<AdminHelp title="計薪職位與支援工作">本班計薪職位由值班規劃提報並經理核准，開始上班時鎖定。幕後工作僅限開發人員。此處僅調整接單及支援工作，不會改變計薪職位、打卡或帳號權限。</AdminHelp></span>
    </div>
    <div className="adminWorkStatusIntake">
      <div className="adminFieldHeading">
        <AdminToggle
          checked={Boolean(mode && !mode.stopAcceptingNewOrders)}
          disabled={unavailable}
          label="接受新指名"
          ariaLabel={`${staff.displayName}接受新指名`}
          onChange={(enabled: boolean) => void apply({ kind: "intake", enabled })}
        />
        <AdminHelp title="接受新指名說明">關閉只暫停新指名，既有預約保留；接單仍須符合核准班表與公開指名資格。面板切換及支援開關不會自動開放指名。</AdminHelp>
      </div>
      {!staff.isActive && <small>此店員的公開卡片已隱藏；當班開關不會自動公開卡片或開放指名。</small>}
    </div>
    <fieldset className="adminWorkStatusRoles">
      <legend><span className="adminFieldHeading">目前支援工作<AdminHelp title="目前支援工作說明">支援工作可複選，控制當班職位廣播受眾，不受單一計薪職位限制。只能在核准班次時段內調整；指名支援仍須具備開放指名資格。</AdminHelp></span></legend>
      <div className="adminWorkStatusOptions">
        {workRoleOptions.filter((option) => option.id !== "backstage" || staff.canUseBackstage || mode?.activeRoles.includes("backstage")).map((option) => {
          const allowed = mode?.allowedSupportRoles.includes(option.id) === true;
          const enabled = mode?.activeRoles.includes(option.id) === true;
          return <div className="adminWorkStatusOption" key={option.id}>
            <AdminToggle
              checked={enabled}
              disabled={unavailable || !mode?.isWorking || (!allowed && !enabled)}
              label={option.label}
              ariaLabel={`${staff.displayName}支援${option.label}`}
              onChange={(enabled: boolean) => void apply({ kind: "role", role: option.id, enabled })}
            />
            <small>{allowed ? "可當班支援" : "尚未開放此工作資格"}</small>
          </div>;
        })}
      </div>
    </fieldset>
    {!mode?.isWorking && <p className="adminWorkStatusHint" role="status">目前不在核准班次時段內；可查看面板，當班支援需先確認<a href="/admin/duty-planning">值班規劃</a>。</p>}
    {!mode && <p className="adminFormError" role="alert">工作狀態暫無法確認，請重新整理。</p>}
    {busy && <p role="status">工作狀態更新中…</p>}
    {error && <p className="adminFormError" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
