import type { Dispatch, SetStateAction } from "react";
import { AdminButton, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import type { SettlementStaff } from "./types";

export type SettlementPaymentForm = { staffId: string; eventKind: string; amount: string; reason: string };
export type SettlementCorrectionForm = { sourceKind: string; sourceId: string; staffId: string; amountDelta: string; reason: string };
type Props = {
  staff: SettlementStaff[];
  payment: SettlementPaymentForm;
  setPayment: Dispatch<SetStateAction<SettlementPaymentForm>>;
  correction: SettlementCorrectionForm;
  setCorrection: Dispatch<SetStateAction<SettlementCorrectionForm>>;
  saving: boolean;
  onPayment: () => Promise<void>;
  onCorrection: () => Promise<void>;
};

export function SettlementPostActions({ staff, payment, setPayment, correction, setCorrection, saving, onPayment, onCorrection }: Props) {
  return <>
    <details className="adminSettlementDisclosure">
      <AdminDisclosureSummary>記錄支付／追回</AdminDisclosureSummary>
      <div className="adminSettlementDisclosureBody">
        <p className="adminSettlementHint">支付與追回分別記錄，原結算快照保持不變。</p>
        <div className="adminFormGrid">
          <AdminField label="人員"><select value={payment.staffId} disabled={saving} onChange={event => setPayment(current => ({ ...current, staffId: event.target.value }))}><option value="">選擇人員</option>{staff.map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></AdminField>
          <AdminField label="類型"><select value={payment.eventKind} disabled={saving} onChange={event => setPayment(current => ({ ...current, eventKind: event.target.value }))}><option value="payout">支付／補發</option><option value="recovery">追回</option></select></AdminField>
          <AdminField label="金額"><input type="number" min="1" value={payment.amount} disabled={saving} onChange={event => setPayment(current => ({ ...current, amount: event.target.value }))} /></AdminField>
          <AdminField label="原因"><input value={payment.reason} disabled={saving} onChange={event => setPayment(current => ({ ...current, reason: event.target.value }))} /></AdminField>
        </div>
        <div className="adminSettlementActionBar"><AdminButton variant="secondary" disabled={saving} onClick={() => void onPayment()}>記錄支付／追回</AdminButton></div>
      </div>
    </details>
    <details className="adminSettlementDisclosure">
      <AdminDisclosureSummary>建立結算後更正差額</AdminDisclosureSummary>
      <div className="adminSettlementDisclosureBody">
        <p className="adminSettlementHint">現場費用與出勤差額各自建立更正案件，保留歷史快照。</p>
        <div className="adminFormGrid">
          <AdminField label="更正來源"><select value={correction.sourceKind} disabled={saving} onChange={event => setCorrection(current => ({ ...current, sourceKind: event.target.value }))}><option value="finance">現場費用</option><option value="attendance">出勤／工時</option><option value="manual">其他</option></select></AdminField>
          <AdminField label="原案件／紀錄編號"><input value={correction.sourceId} disabled={saving} onChange={event => setCorrection(current => ({ ...current, sourceId: event.target.value }))} /></AdminField>
          <AdminField label="指定人員（可留白）"><select value={correction.staffId} disabled={saving} onChange={event => setCorrection(current => ({ ...current, staffId: event.target.value }))}><option value="">共同／待分配</option>{staff.map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></AdminField>
          <AdminField label="應付差額"><input type="number" value={correction.amountDelta} disabled={saving} onChange={event => setCorrection(current => ({ ...current, amountDelta: event.target.value }))} /></AdminField>
          <AdminField label="原因"><input value={correction.reason} disabled={saving} onChange={event => setCorrection(current => ({ ...current, reason: event.target.value }))} /></AdminField>
        </div>
        <div className="adminSettlementActionBar"><AdminButton variant="secondary" disabled={saving} onClick={() => void onCorrection()}>建立更正差額</AdminButton></div>
      </div>
    </details>
  </>;
}
