import { useEffect, useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { admissionCreationApi } from "./admission-creation-api";

type Policy = { amount: number | null; version: number };
type Props = { disabled?: boolean; onSaved?: () => void };

const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;

export function AdmissionFeeSettings({ disabled = false, onSaved }: Props) {
  const [fee, setFee] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    admissionCreationApi.policy(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setPolicy({ amount: value.admissionAmount, version: value.version });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "讀取入場費設定失敗。");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const reload = async () => {
    setSaving(true);
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const value = await admissionCreationApi.policy();
      setPolicy({ amount: value.admissionAmount, version: value.version });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "讀取入場費設定失敗。");
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  const amount = Number(fee);
  const validAmount = fee.trim() !== "" && Number.isSafeInteger(amount) && amount >= 0 && amount <= 1_000_000_000_000;
  const save = async () => {
    if (saving || disabled || !policy || !validAmount || !reason.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const value = await admissionCreationApi.savePolicy({
        admissionAmount: amount,
        expectedVersion: policy.version,
        reason: reason.trim(),
      });
      setPolicy({ amount: value.admissionAmount, version: value.version });
      setMessage("入場費已更新；若已開啟開碼表單，收費預覽已重新讀取。");
      onSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "儲存入場費失敗。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="adminAdmissionPolicy" aria-labelledby="admin-admission-policy-title">
      <header>
        <div>
          <div className="adminFieldHeading">
            <h3 id="admin-admission-policy-title">入場費設定</h3>
            <AdminHelp title="入場費設定說明">此設定只影響後續開立點餐碼；餐點信物折抵額度另由點餐營運參數管理。</AdminHelp>
          </div>
        </div>
      </header>
      <p className="adminAdmissionPolicyCurrent" aria-live="polite">
        目前設定：{policy ? policy.amount === null ? "尚未設定" : `${money(policy.amount)}（版本 ${policy.version}）` : loading ? "讀取中…" : "無法取得設定"}
      </p>
      <div className="adminAdmissionPolicyFields">
        <label>
          入場費（G）
          <input
            type="text"
            inputMode="numeric"
            value={fee}
            disabled={saving || disabled}
            onChange={(event) => { setFee(event.target.value); setMessage(""); }}
          />
        </label>
        <label>
          變更原因
          <input
            value={reason}
            maxLength={500}
            disabled={saving || disabled}
            onChange={(event) => { setReason(event.target.value); setMessage(""); }}
          />
        </label>
      </div>
      <div className="adminAdmissionPolicyActions">
        <AdminButton variant="ghost" disabled={saving || disabled} onClick={() => void reload()}>
          重讀設定版本
        </AdminButton>
        <AdminButton
          variant="secondary"
          disabled={saving || disabled || !policy || !validAmount || !reason.trim()}
          onClick={() => void save()}
        >
          {saving ? "儲存中…" : "儲存入場費"}
        </AdminButton>
      </div>
      {message ? <p className="adminAdmissionPolicyMessage" role="status">{message}</p> : null}
      {error ? <p className="adminFormError" role="alert">{error}</p> : null}
    </section>
  );
}
