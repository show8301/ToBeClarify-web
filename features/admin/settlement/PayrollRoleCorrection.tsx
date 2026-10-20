import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { isPayrollRole, payrollRoleLabel, payrollRoleOptions } from "@/features/admin/shared/workRoles";
import type { PayrollRole } from "@/features/admin/shared/workRoles";

type Snapshot = { payrollRole: PayrollRole | null; version: number; backstage: boolean; manager: boolean };
type Props = {
  businessDate: string;
  staffId: string;
  displayName: string;
  finalized: boolean;
  onClose: () => void;
  onChanged: () => Promise<boolean>;
  onBusyChange: (busy: boolean) => void;
};

function readSnapshot(value: unknown, staffId: string): Snapshot {
  if (!value || typeof value !== "object" || !("staff" in value) || !Array.isArray(value.staff)) throw new Error("無法讀取職位資料。");
  const row: unknown = value.staff.find((item: unknown) => item && typeof item === "object" && "staffId" in item && item.staffId === staffId);
  if (!row || typeof row !== "object" || !("payrollSnapshotVersion" in row) || typeof row.payrollSnapshotVersion !== "number"
    || !Number.isSafeInteger(row.payrollSnapshotVersion) || row.payrollSnapshotVersion < 1) throw new Error("尚無上班職位快照，請先在出勤區確認。");
  return {
    payrollRole: "payrollRole" in row && typeof row.payrollRole === "string" && isPayrollRole(row.payrollRole) ? row.payrollRole : null,
    version: row.payrollSnapshotVersion,
    backstage: "canUseBackstage" in row && row.canUseBackstage === true,
    manager: "canUseManagerPayrollRole" in row && row.canUseManagerPayrollRole === true,
  };
}

export function PayrollRoleCorrection({ businessDate, staffId, displayName, finalized, onClose, onChanged, onBusyChange }: Props) {
  const formId = useId();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [role, setRole] = useState<PayrollRole | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const operationId = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi.getAttendance(businessDate, controller.signal).then((value: unknown) => {
      if (controller.signal.aborted) return;
      const next = readSnapshot(value, staffId);
      setSnapshot(next);
      setRole(next.payrollRole || "");
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "無法讀取職位。");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [businessDate, staffId, revision]);
  const refresh = async () => {
    if (await onChanged()) onClose();
    else setError("職位已更正，但結算資料刷新失敗。請重新讀取，無須重送更正。");
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current || !snapshot || !role || role === snapshot.payrollRole || !reason.trim()) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      operationId.current ??= crypto.randomUUID();
      await adminApi.applyAttendance({ operationId: operationId.current, businessDate, staffId,
        action: "confirm_payroll_role", payrollRole: role, expectedPayrollSnapshotVersion: snapshot.version, reason: reason.trim() });
      setSaved(true);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "更正失敗，請重新讀取職位後核對。"); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  };
  return <AdminDialog open title={`更正計薪職位 · ${displayName}`} onClose={() => { if (!lock.current) onClose(); }}
    description="此更正適用整個營業日，保留工時、原核准來源及更正歷程，不改變登入權限。"
    actions={<>
      <AdminButton variant="ghost" disabled={busy} onClick={onClose}>關閉</AdminButton>
      {saved ? <AdminButton disabled={busy} onClick={() => void refresh()}>重新讀取結算</AdminButton>
        : <AdminButton type="submit" form={formId} disabled={busy || loading || !snapshot || !role || role === snapshot.payrollRole || !reason.trim()}>確認更正職位</AdminButton>}
    </>}>
    <form id={formId} onSubmit={event => void submit(event)} aria-busy={busy || loading}>
      <p>營業日：{businessDate}；原職位：{snapshot ? payrollRoleLabel(snapshot.payrollRole) : "讀取中…"}</p>
      <p>{finalized ? "原正式結算金額保持不變。更正後請前往最終步驟，核對全員差額、填寫原因並重新結算。" : "更正後舊試算失效，請核對輸入並重新計算。"}同日其他時段也須核對。</p>
      <AdminField label="正確計薪職位"><select value={role} disabled={busy || loading || saved} onChange={event => { if (isPayrollRole(event.target.value)) { setRole(event.target.value); operationId.current = null; } }}>
        <option value="">請選擇</option>
        {payrollRoleOptions.filter(option => (option.id !== "manager" || snapshot?.manager) && (option.id !== "backstage" || snapshot?.backstage)).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select></AdminField>
      <AdminField label="更正原因" required><textarea rows={3} maxLength={500} value={reason} disabled={busy || saved} onChange={event => { setReason(event.target.value); operationId.current = null; }} /></AdminField>
      {error ? <p role="alert">{error}</p> : null}
      {!saved ? <AdminButton variant="ghost" disabled={busy || loading} onClick={() => { setLoading(true); setError(""); setSnapshot(null); operationId.current = null; setRevision(value => value + 1); }}>重新讀取職位</AdminButton> : null}
    </form>
  </AdminDialog>;
}
