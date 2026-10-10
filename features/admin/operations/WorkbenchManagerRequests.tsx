"use client";

import { useRef, useState } from "react";
import { AdminButton, AdminDialog, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { WorkbenchOrderComposer } from "./WorkbenchOrderComposer";
import { WorkbenchServiceDialog } from "./WorkbenchServiceDialog";
import { errorText, workbenchApi } from "./workbenchApi";
import type { ServiceEntry } from "./WorkbenchServiceDialog";
import type { OperationsData, OperationsNominee, OperationsOrder } from "./operationsTypes";

export function WorkbenchManagerRequests({ data, onChanged }: { data: OperationsData; onChanged: () => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [entry, setEntry] = useState<ServiceEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const sessions = data.sessions.filter((s) => s.status === "active" && s.entryStatus !== "departed");
  const requests = data.orders.flatMap((order) => order.nominees.filter((n) => n.confirmationStatus === "needs_coordination").map((nominee) => ({ order, nominee })));
  const onBusy = (value: boolean) => { busyRef.current = value; setBusy(value); };
  const loadEntry = async (order: OperationsOrder, nominee: OperationsNominee) => {
    if (busyRef.current) return;
    onBusy(true); setError("");
    try {
      const units = (order.flowVersion || 1) >= 2 ? await workbenchApi.units(order.id) : [];
      const unit = units.find((u) => u.kind === "nominee" && u.nomineeId === nominee.id) || null;
      if ((order.flowVersion || 1) >= 2 && (!unit || !unit.allowedActions.includes("reschedule"))) throw new Error("此請求已更新，請重新整理。");
      setEntry({ order, nominee, unit, status: "needs_coordination" });
    } catch (e) { setError(errorText(e)); }
    finally { onBusy(false); }
  };
  const saved = async () => { await onChanged(); setEntry(null); setCreateOpen(false); };
  return <AdminPanel title="指名承接協調" description="由經理建立新請求；指名人員無法承接時，在這裡重新協調。" actions={<AdminButton disabled={busy || !sessions.length || !data.context?.referenceBusinessDate} onClick={() => { setSessionId(sessions[0]?.id || ""); setCreateOpen(true); }}>建立承接請求</AdminButton>}>
    {error && <p className="adminFormError" role="alert">{error}</p>}
    <div className="adminRoleDashboardRows">{requests.map(({ order, nominee }) => <article className="adminRoleDashboardRow" key={nominee.id}><div className="adminRoleDashboardIdentity"><strong>{order.customerName} · {nominee.staffName}</strong><small>{nominee.serviceName} · 無法承接，訂單及金額保留</small></div><AdminButton variant="secondary" disabled={busy} onClick={() => void loadEntry(order, nominee)}>重新協調時間</AdminButton></article>)}{!requests.length && <p className="adminRoleDashboardEmpty">目前沒有退回的承接請求。</p>}</div>
    <AdminDialog open={createOpen} title="建立指名承接請求" description="由指定人員回覆承接，不變更既有指名的負責人。" onClose={() => { if (!busyRef.current) setCreateOpen(false); }} className="adminDesignatedWorkbenchDialog" actions={null}>
      <AdminField label="顧客"><select value={sessionId} disabled={busy} onChange={(e) => setSessionId(e.target.value)}>{sessions.map((s) => <option key={s.id} value={s.id}>{s.customerName} · {s.gameId}</option>)}</select></AdminField>
      {sessionId && <WorkbenchOrderComposer key={sessionId} sessionId={sessionId} businessDate={data.context?.referenceBusinessDate || ""} mode="transfer" staffId="" onSaved={saved} onBusy={onBusy} />}
    </AdminDialog>
    <AdminDialog open={Boolean(entry)} title="重新協調時間" description="保留原指名人員，安排後重新等待承接確認。" onClose={() => { if (!busyRef.current) setEntry(null); }} className="adminDesignatedWorkbenchDialog" actions={null}>
      {entry && <>{!entry.unit && <p className="dwNotice">這是舊版整單流程。改期會重新等待同一張訂單內各指名人員的確認，請先核對其他指名。</p>}<WorkbenchServiceDialog entry={entry} action="reschedule" onSaved={saved} onBusy={onBusy} /></>}
    </AdminDialog>
  </AdminPanel>;
}
