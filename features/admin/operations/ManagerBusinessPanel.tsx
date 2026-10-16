"use client";

import { useState } from "react";
import { BusinessDayPlanPanel } from "@/features/admin/orders/BusinessDayPlanPanel";
import { AdminButton, AdminDialog, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { formatDateTime, intakeModeLabel, periodStatusLabel } from "./operationsFormat";
import type { OperationsContext } from "./operationsTypes";
import type { ManagerSettings } from "./managerOverview";
import type { ManagerBusinessAction } from "./ManagerBusinessActionDialog";

type Props = {
  context: OperationsContext;
  disabled: boolean;
  settings: ManagerSettings | null;
  onChanged: () => Promise<void>;
  onAction: (action: ManagerBusinessAction) => void;
};

export function ManagerBusinessPanel({ context, disabled, settings, onChanged, onAction }: Props) {
  const [planOpen, setPlanOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const open = context.periodStatus === "open";
  const closed = context.periodStatus === "closed" || context.periodStatus === "settled";
  const unavailable = disabled || planBusy;

  const showPlan = () => { setPlanBusy(false); setPlanOpen(true); };

  return <>
    <AdminPanel title="營運控制" className="managerBusiness" actions={<span className="managerBusinessState">{disabled ? "狀態確認中" : periodStatusLabel(context.periodStatus)}</span>}>
      <div className="managerBusinessStatus">
        <span>營業日 {context.referenceBusinessDate}</span>
        <span>預計關店 {formatDateTime(context.projectedCloseAt || context.referenceEndsAt)}</span>
      </div>
      {open && <div className="managerBusinessModes" role="group" aria-label="全店接單模式">
        {(["normal", "coordination", "staff_only"] as const).map((mode) => <AdminButton
          key={mode}
          variant={context.intakeMode === mode ? "primary" : "secondary"}
          aria-pressed={context.intakeMode === mode}
          disabled={unavailable || context.intakeMode === mode}
          onClick={() => onAction({ type: "intake", intakeMode: mode })}
        >{intakeModeLabel(mode)}</AdminButton>)}
      </div>}
      {!closed && <p className="managerHint">
        {settings ? settings.nominationPaused
          ? `新指名暫停至 ${formatDateTime(settings.pausedUntil)}`
          : "新指名未暫停" : "新指名暫停狀態尚未確認"}
      </p>}
      <div className="managerBusinessActions">
        {!open && <AdminButton disabled={unavailable} onClick={showPlan}>{closed ? "安排下次營業" : "營業計畫／開店"}</AdminButton>}
        {open && <AdminButton variant="secondary" disabled={unavailable} onClick={() => onAction({ type: "time" })}>調整時間</AdminButton>}
        {!closed && <AdminButton
          variant="secondary"
          disabled={unavailable || !settings}
          onClick={() => onAction({ type: settings?.nominationPaused ? "resume" : "pause" })}
        >{settings?.nominationPaused ? "解除暫停" : "暫停指名"}</AdminButton>}
        {(open || context.periodStatus === "closed") && <details className="managerBusinessMore">
          <summary>更多操作</summary>
          <div className="managerBusinessMoreContent">
            {open && <AdminButton variant="ghost" disabled={unavailable} onClick={showPlan}>營業計畫／開店</AdminButton>}
            {context.periodStatus === "closed" && <AdminButton variant="ghost" disabled={unavailable} onClick={() => onAction({ type: "reopen" })}>誤關重開</AdminButton>}
          </div>
        </details>}
      </div>
    </AdminPanel>
    <AdminDialog
      open={planOpen}
      title="營業計畫與開店"
      description="時間以台灣時間填寫；跨午夜請確認結束日期，儲存計畫後仍須手動開店。"
      className="managerBusinessPlanDialog"
      onClose={() => { if (!planBusy) setPlanOpen(false); }}
      actions={null}
    >
      <BusinessDayPlanPanel
        businessDate={context.referenceBusinessDate}
        compact
        onBusyChange={setPlanBusy}
        onOpened={async () => { await onChanged(); setPlanBusy(false); setPlanOpen(false); }}
      />
    </AdminDialog>
  </>;
}
