"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { fulfillmentActionNeedsReason, getFulfillmentQuantityLimit, isWholeQuantityTransfer } from "./fulfillment-operation";
import type { FulfillmentDraft, FulfillmentQuantityState } from "./fulfillment-operation";

function FulfillmentField({ label, help, required = false, className = "", children }: {
  label: string;
  help: string;
  required?: boolean;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return <div className={"adminFulfillmentField " + className}>
    <div className="adminFulfillmentFieldHeading">
      <label htmlFor={id}>{label}{required && <span className="adminFulfillmentRequired" aria-label="必填"> *</span>}</label>
      <AdminHelp title={label + "說明"}>{help}</AdminHelp>
    </div>
    {children(id)}
  </div>;
}

export function FulfillmentQuantityField({ value, max, fixed = false, transferring = false, disabled, onChange }: {
  value: number;
  max: number;
  fixed?: boolean;
  transferring?: boolean;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return <FulfillmentField
    label={transferring ? "本次轉移" : "本次數量"}
    className="adminFulfillmentQuantityField"
    help={transferring
      ? "餐點及包廂跨營業期時，必須一次移轉全部尚未服務的數量。"
      : "填寫這次要處理的份數；接單、開始、完成與取消的可處理數量會依目前進度不同。"}
  >{id => fixed
    ? <output id={id} className="adminFulfillmentFixedQuantity">{value} 份{transferring ? "（全部）" : ""}</output>
    : <div className="adminFulfillmentQuantityInput">
      <input id={id} type="number" inputMode="numeric" min={1} max={max} step={1} value={value}
        disabled={disabled} onChange={event => onChange(Number(event.target.value))} />
      <span>份</span>
    </div>
  }</FulfillmentField>;
}

interface EditorProps {
  unit: FulfillmentQuantityState & { restMinutesReserved: number };
  action: string;
  draft: FulfillmentDraft;
  periods: ReadonlyArray<{ id: string; businessDate: string; status: string }>;
  periodsLoading: boolean;
  periodsError: string;
  completionReasonRequired: boolean;
  disabled: boolean;
  onChange: (patch: Partial<FulfillmentDraft>) => void;
}

export function FulfillmentUnitFields({ unit, action, draft, periods, periodsLoading, periodsError, completionReasonRequired, disabled, onChange }: EditorProps) {
  const restGroupId = useId();
  const scheduling = action === "reschedule" || action === "carry_forward";
  const transferring = isWholeQuantityTransfer(unit, action);
  const quantityLimit = getFulfillmentQuantityLimit(unit, action);
  const showReason = action !== "start_now";
  const reasonRequired = fulfillmentActionNeedsReason(action) || completionReasonRequired;
  return <div className="adminFulfillmentEditorFields">
    <FulfillmentQuantityField
      value={transferring ? quantityLimit : draft.quantity}
      max={quantityLimit}
      fixed={transferring || unit.quantity === 1}
      transferring={transferring}
      disabled={disabled}
      onChange={quantity => onChange({ quantity })}
    />
    {scheduling && <div className="adminFulfillmentDateFields">
      <FulfillmentField
        label="履約營業期"
        className="adminFulfillmentPeriodField"
        help={action === "carry_forward"
          ? "只列出可履約的營業期。不選目標時先標記待跨期，之後再指定其他營業期；原訂單及金額歸屬保留。"
          : "可沿用原營業期，或選擇已開放履約的其他營業期。"}
      >{id => <select id={id} value={draft.targetBusinessPeriodId} disabled={disabled || periodsLoading}
        onChange={event => onChange({ targetBusinessPeriodId: event.target.value })}>
        <option value="">{action === "carry_forward" ? "先保留，稍後指定營業期" : "沿用原營業期"}</option>
        {periods.map(period => <option key={period.id} value={period.id}>
          {period.businessDate}（{period.status === "coordination" ? "協調" : "營業中"}）
        </option>)}
      </select>}</FulfillmentField>
      {unit.kind === "nominee" && <FulfillmentField
        label="新開始時間"
        className="adminFulfillmentDateField"
        required={action === "reschedule" || Boolean(draft.targetBusinessPeriodId)}
        help="使用台灣時間。指名改期或指定跨期目標時需填寫新開始時間，原購買服務分鐘保持不變。"
      >{id => <input id={id} type="datetime-local" value={draft.startsAt} disabled={disabled}
        required={action === "reschedule" || Boolean(draft.targetBusinessPeriodId)}
        onChange={event => onChange({ startsAt: event.target.value })} />}</FulfillmentField>}
    </div>}
    {scheduling && periodsLoading && <p className="adminFulfillmentNotice" role="status">讀取可履約營業期中…</p>}
    {scheduling && periodsError && <p className="adminFulfillmentNotice isError" role="alert">{periodsError}</p>}
    {action === "backfill" && <div className="adminFulfillmentDateFields">
      <FulfillmentField label="實際開始" required className="adminFulfillmentDateField"
        help="填寫實際服務的台灣日期及時間，不可填寫未來時間。">
        {id => <input id={id} type="datetime-local" value={draft.actualStartsAt} disabled={disabled} required
          onChange={event => onChange({ actualStartsAt: event.target.value })} />}
      </FulfillmentField>
      <FulfillmentField label="實際結束" className="adminFulfillmentDateField"
        help={unit.kind === "meal" || unit.kind === "room"
          ? "餐點及包廂補登會完成本次數量；結束時間可留空，沿用實際開始時間。"
          : "只有已完成服務才填寫。留空表示補登開始後仍在服務中；結束時間不可早於開始時間。"}>
        {id => <input id={id} type="datetime-local" value={draft.actualEndsAt} disabled={disabled}
          onChange={event => onChange({ actualEndsAt: event.target.value })} />}
      </FulfillmentField>
    </div>}
    {showReason && <FulfillmentField label="操作原因" required={reasonRequired}
      className="adminFulfillmentReasonField"
      help="無法承接、取消、改期、跨期保留及補登時必填；指名或加購服務提早完成時也必須填寫。最多 500 字，提早完成不會自動折讓。">
      {id => <>
        <textarea id={id} rows={2} value={draft.reason} maxLength={500} disabled={disabled} required={reasonRequired}
          placeholder="填寫本次處理原因" onChange={event => onChange({ reason: event.target.value })} />
        <span className="adminFulfillmentCharacterCount">{draft.reason.length} / 500</span>
      </>}
    </FulfillmentField>}
    {action === "start_now" && <>
      <div className="adminFulfillmentRestSettings">
        <div className="adminFulfillmentFieldHeading">
          <span>休息安排</span>
          <AdminHelp title="休息安排說明">{"保留原休息會沿用預留分鐘；不占休息可另登折讓，但服務購買分鐘不會縮短。"}</AdminHelp>
        </div>
        <div className="adminFulfillmentRestOptions">
          <label><input type="radio" name={restGroupId} checked={draft.restMinutes === unit.restMinutesReserved}
            disabled={disabled} onChange={() => onChange({ restMinutes: unit.restMinutesReserved })} />保留原休息 {unit.restMinutesReserved} 分鐘</label>
          {unit.restMinutesReserved > 0 && <label><input type="radio" name={restGroupId} checked={draft.restMinutes === 0}
            disabled={disabled} onChange={() => onChange({ restMinutes: 0 })} />本次不占休息</label>}
        </div>
      </div>
      <FulfillmentField label="折讓金額" className="adminFulfillmentAmountField"
        help="以 Gil 填寫本次折讓；沒有折讓時填 0，有折讓時須填寫折讓原因。">
        {id => <input id={id} type="number" inputMode="numeric" min={0} max={2000000000} step={1}
          value={draft.compensationAmount} disabled={disabled}
          onChange={event => onChange({ compensationAmount: Math.max(0, Number(event.target.value)) })} />}
      </FulfillmentField>
      <FulfillmentField label="折讓／待確認原因" required={draft.compensationAmount > 0}
        className="adminFulfillmentReasonField" help="說明本次折讓或需要確認的事項，最多 500 字。">
        {id => <textarea id={id} rows={2} maxLength={500} value={draft.compensationReason} disabled={disabled} required={draft.compensationAmount > 0}
          onChange={event => onChange({ compensationReason: event.target.value })} />}
      </FulfillmentField>
    </>}
  </div>;
}
