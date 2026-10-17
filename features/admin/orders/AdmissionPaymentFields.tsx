import { useEffect, useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import { admissionCreationApi } from "./admission-creation-api";
import type { useAdmissionCreation } from "./useAdmissionCreation";

const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;

export function AdmissionPaymentFields({ payment, canManage }: { payment: ReturnType<typeof useAdmissionCreation>; canManage: boolean }) {
  const [fee, setFee] = useState("");
  const [policyReason, setPolicyReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState<{ amount: number | null; version: number } | null>(null);
  useEffect(() => {
    if (!canManage) return;
    const c = new AbortController();
    admissionCreationApi.policy(c.signal).then((p) => { if (!c.signal.aborted) setPolicy({ amount: p.admissionAmount, version: p.version }); })
      .catch((e: unknown) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "讀取設定失敗。"); });
    return () => c.abort();
  }, [canManage]);
  const reloadPolicy = async () => {
    setSaving(true); setError("");
    try { const p = await admissionCreationApi.policy(); setPolicy({ amount: p.admissionAmount, version: p.version }); }
    catch (e) { setError(e instanceof Error ? e.message : "讀取設定失敗。"); }
    finally { setSaving(false); }
  };
  const save = async () => {
    if (saving || payment.locked || !policy) return;
    setSaving(true); setError("");
    try {
      const next = await admissionCreationApi.savePolicy({ admissionAmount: Number(fee), expectedVersion: policy.version, reason: policyReason.trim() });
      setPolicy({ amount: next.admissionAmount, version: next.version });
      await payment.load();
    } catch (e) { setError(e instanceof Error ? e.message : "儲存入場費失敗。"); }
    finally { setSaving(false); }
  };
  return <section className="adminAdmissionPayment" aria-label="入場收款確認">
    <h3>入場收款</h3>
    {payment.preview ? <>
      <p>入場費 <strong>{money(payment.preview.admissionAmount)}</strong> · 餐點折抵額度 {money(payment.preview.mealCreditAmount)}</p>
      <p>收款營業日：{payment.preview.businessDate} · 預覽有效至 {new Date(payment.preview.expiresAt).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei" })}</p>
      {canManage && <div className="adminAdmissionFields">
        <label>收款狀態<select disabled={payment.locked} value={payment.mode} onChange={(e) => { const value = e.target.value; if (value === "received" || value === "unpaid" || value === "waived") { payment.setMode(value); payment.setConfirmed(false); } }}><option value="received">已收款</option><option value="unpaid">未收款／轉未決</option><option value="waived">免收</option></select></label>
        {payment.mode !== "waived" && <label>優惠／折讓<input type="number" min={0} max={payment.preview.admissionAmount} step={1} value={payment.discount} disabled={payment.locked} onChange={(e) => { payment.setDiscount(Number(e.target.value)); payment.setConfirmed(false); }} /></label>}
        {(payment.mode !== "received" || payment.discount > 0) && <label>例外原因<input required maxLength={500} value={payment.reason} disabled={payment.locked} onChange={(e) => payment.setReason(e.target.value)} /></label>}
      </div>}
      <p>本次實收：<strong>{money(payment.received)}</strong></p>
      {payment.mode === "received" && <label className="adminAdmissionConfirm"><input type="checkbox" required checked={payment.confirmed} disabled={payment.locked} onChange={(e) => payment.setConfirmed(e.target.checked)} />已確認收到上述入場費</label>}
    </> : <p>尚未取得有效收費預覽，請確認已開啟新版營業期與收費設定。</p>}
    <AdminButton variant="ghost" disabled={payment.locked} onClick={() => void payment.load()}>重新讀取收費</AdminButton>
    {canManage && <details><summary>設定入場費</summary><p>這會變更後續開碼的收費；餐點折抵額度另由營運參數管理。</p><p>目前設定：{policy ? policy.amount === null ? "尚未設定" : `${money(policy.amount)}（版本 ${policy.version}）` : "尚未取得設定"}</p><AdminButton variant="ghost" disabled={saving || payment.locked} onClick={() => void reloadPolicy()}>重讀設定版本</AdminButton>
      <label>入場費（G）<input type="text" inputMode="numeric" value={fee} disabled={saving || payment.locked} onChange={(e) => setFee(e.target.value)} /></label>
      <label>變更原因<input maxLength={500} value={policyReason} disabled={saving || payment.locked} onChange={(e) => setPolicyReason(e.target.value)} /></label>
      <AdminButton variant="secondary" disabled={saving || payment.locked || !policy || !fee.trim() || !policyReason.trim() || !Number.isSafeInteger(Number(fee)) || Number(fee) < 0 || Number(fee) > 1_000_000_000_000} onClick={() => void save()}>儲存入場費並更新預覽</AdminButton>
      {error && <p role="alert">{error}</p>}
    </details>}
    {payment.error && <p className="adminFormError" role="alert">{payment.error}</p>}
    {payment.pending && <div role="status"><p>結果尚未確認，請保留此畫面；重試會沿用同一筆收款。</p><AdminButton disabled={payment.busy} onClick={() => void payment.lookup()}>查回這筆開碼結果</AdminButton></div>}
    {payment.result && <div role="status"><p>已確認入場紀錄，實收 {money(payment.result.receivedAmount)}。原點餐資料未保存；重發不會再收取入場費。</p><AdminButton disabled={payment.busy} onClick={() => void payment.reissue()}>確認重發點餐資料（原碼失效）</AdminButton></div>}
  </section>;
}
