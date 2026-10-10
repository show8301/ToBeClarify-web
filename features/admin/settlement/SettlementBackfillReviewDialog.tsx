import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AdminButton, AdminDialog, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { settlementRoles } from "./presentation";
import type { SettlementBackfillReview } from "./types";

type Props = {
  review: SettlementBackfillReview;
  saving: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
};

export function SettlementBackfillReviewDialog({ review, saving, onClose, onSubmit }: Props) {
  const formId = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const { request, approved } = review;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || submitting.current) return;
    if (!approved && !note.trim()) {
      setError("請填寫拒絕原因。");
      return;
    }
    submitting.current = true;
    setError("");
    try {
      await onSubmit(note.trim());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "審核未完成，請稍後再試。");
    } finally {
      submitting.current = false;
    }
  };

  return (
    <AdminDialog
      open
      className="adminSettlementReviewDialog"
      title={approved ? "核准補打卡" : "拒絕補打卡"}
      description={approved ? "核對申請後確認核准，備註可留白。" : "請填寫拒絕原因，讓申請人了解需要修正的內容。"}
      onClose={() => { if (!saving && !submitting.current) onClose(); }}
      actions={<>
        <AdminButton variant="ghost" disabled={saving} onClick={onClose}>取消</AdminButton>
        <AdminButton type="submit" form={formId} disabled={saving} variant={approved ? "primary" : "danger"}>
          {saving ? "送出中…" : approved ? "確認核准" : "確認拒絕"}
        </AdminButton>
      </>}
    >
      <form id={formId} className="adminSettlementReviewForm" noValidate onSubmit={event => void submit(event)} aria-busy={saving}>
        <dl className="adminSettlementDefinitionList">
          <div><dt>申請人員</dt><dd>{request.staffName || request.staffId}</dd></div>
          <div><dt>角色</dt><dd>{settlementRoles[request.role] || request.role}</dd></div>
          <div><dt>營業日期／時段</dt><dd>{review.businessDate} · 第 {review.sessionNo} 時段</dd></div>
          <div><dt>申請分鐘</dt><dd>{request.requestedMinutes} 分鐘</dd></div>
        </dl>
        <div className="adminSettlementReviewReason"><strong>申請理由</strong><p>{request.reason}</p></div>
        <AdminField label={approved ? "核准備註（選填）" : "拒絕原因"} required={!approved}>
          <textarea
            rows={3}
            maxLength={1000}
            value={note}
            required={!approved}
            disabled={saving}
            aria-invalid={!approved && !note.trim() && Boolean(error)}
            aria-describedby={error ? `${formId}-error` : undefined}
            onChange={event => { setNote(event.target.value); setError(""); }}
          />
        </AdminField>
        {error ? <p id={`${formId}-error`} className="adminSettlementInlineWarning" role="alert">{error}</p> : null}
      </form>
    </AdminDialog>
  );
}
