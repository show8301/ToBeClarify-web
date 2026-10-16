import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { CharacterIdentityFields } from "@/components/customer/CharacterIdentityFields";
import { composeCharacterIdentity } from "@/lib/customer-identity";
import { adminApi } from "@/features/admin/api/client.js";
import { customerApi } from "@/features/admin/customers/api";
import type { CustomerIdentityCandidate } from "@/features/admin/customers/types";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";

type IssuedSession = {
  session: { id: string; gameId: string; customerName: string };
  orderUrl: string;
  orderToken: string;
  recoveryCode: string;
};
type Props = { canManage: boolean; onClose: () => void; onIssued: (issued: IssuedSession) => void };
type CandidateState = { key: string; items: CustomerIdentityCandidate[]; error: string };

function parseIssued(value: unknown): IssuedSession {
  if (!value || typeof value !== "object" || !("session" in value)
    || !value.session || typeof value.session !== "object"
    || !("id" in value.session) || typeof value.session.id !== "string"
    || !("gameId" in value.session) || typeof value.session.gameId !== "string"
    || !("customerName" in value.session) || typeof value.session.customerName !== "string"
    || !("orderUrl" in value) || typeof value.orderUrl !== "string"
    || !("orderToken" in value) || typeof value.orderToken !== "string"
    || !("recoveryCode" in value) || typeof value.recoveryCode !== "string") {
    throw new Error("點餐碼回應格式不正確，請先查詢今日入場紀錄，避免重複開碼。");
  }
  return {
    session: { id: value.session.id, gameId: value.session.gameId, customerName: value.session.customerName },
    orderUrl: value.orderUrl, orderToken: value.orderToken, recoveryCode: value.recoveryCode,
  };
}

export function CreateSessionPanel({ canManage, onClose, onIssued }: Props) {
  const uidInputId = useId();
  const [form, setForm] = useState({ gameId: "", serverName: "", customerName: "", customerUid: "", maxNominatedStaff: 1 });
  const [result, setResult] = useState<CandidateState | null>(null);
  const [candidateRevision, setCandidateRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submission = useRef<AbortController | null>(null);
  let identity = null;
  let identityError = "";
  try { identity = composeCharacterIdentity(form.gameId, form.serverName); }
  catch (reason) {
    if (form.gameId.trim() && form.serverName) identityError = reason instanceof Error ? reason.message : "請核對人物 ID 與伺服器。";
  }
  const identityKey = identity?.gameId || "";
  const candidates = result?.key === identityKey ? result.items : [];
  const candidateLoading = Boolean(identityKey && result?.key !== identityKey);
  const candidateError = result?.key === identityKey ? result.error : "";

  useEffect(() => {
    if (!identityKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void customerApi.candidates(identityKey, controller.signal).then((value) => {
        if (!controller.signal.aborted) setResult({ key: identityKey, items: value.items, error: "" });
      }).catch((reason: unknown) => {
        if (!controller.signal.aborted) setResult({ key: identityKey, items: [], error: reason instanceof Error ? reason.message : "無法查詢歷史 UID。" });
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [identityKey, candidateRevision]);

  useEffect(() => () => submission.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.current || candidateLoading || candidateError) return;
    const controller = new AbortController();
    submission.current = controller;
    setLoading(true);
    setError("");
    try {
      const current = composeCharacterIdentity(form.gameId, form.serverName);
      const value: unknown = await adminApi.createOrderSession({
        gameId: current.characterName, serverName: current.serverName,
        customerName: form.customerName.trim() || null,
        customerUid: canManage ? form.customerUid || null : null,
        maxNominatedStaff: form.maxNominatedStaff,
      }, controller.signal);
      if (!controller.signal.aborted) onIssued(parseIssued(value));
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "無法開立點餐碼。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      submission.current = null;
    }
  }

  return <div className="adminOrderInlinePanel adminCreateSessionPanel">
    <header>
      <div>
        <div className="adminCreateSessionHeading">
          <h2>開立今日點餐碼</h2>
          <AdminHelp title="點餐碼填寫說明">人物 ID 最多 6 字，顧客顯示名稱最多 12 字，可同時指名人數為 0–9 人。選擇角色所屬伺服器後，系統以「人物 ID@伺服器」查詢歸戶；唯一候選會自動沿用，多個候選未選擇時先不歸戶。</AdminHelp>
        </div>
      </div>
      <button type="button" aria-label="關閉發點餐碼" disabled={loading} onClick={onClose}>×</button>
    </header>
    <form onSubmit={(event) => { void submit(event); }}>
      <CharacterIdentityFields gameId={form.gameId} serverName={form.serverName} disabled={loading} gameIdMaxLength={6} showPreview={false}
        onGameIdChange={(gameId) => setForm({ ...form, gameId, customerUid: "" })}
        onServerChange={(serverName) => setForm({ ...form, serverName, customerUid: "" })} />
      <label className="adminSessionDisplayName">
        <span>顧客顯示名稱（選填）</span>
        <input maxLength={12} value={form.customerName} disabled={loading} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
      </label>
      <label className="adminSessionNominationLimit">
        <span>可同時指名人數</span>
        <input type="number" inputMode="numeric" min="0" max="9" required value={form.maxNominatedStaff} disabled={loading} onChange={(event) => setForm({ ...form, maxNominatedStaff: Number(event.target.value) })} />
      </label>
      {canManage ? <div className="adminSessionExistingUid">
        <div className="adminSessionFieldHeading">
          <label htmlFor={uidInputId}>既有 UID（選填）</label>
          <AdminHelp title="既有 UID 填寫說明">若要延續未記錄伺服器的舊顧客，請先核對歷史資料，於開碼前填入既有 UID。留空時依相同人物及伺服器的候選規則處理。</AdminHelp>
        </div>
        <input id={uidInputId} value={form.customerUid} maxLength={40} disabled={loading} autoComplete="off" onChange={(event) => setForm({ ...form, customerUid: event.target.value.trim().toUpperCase() })} />
      </div> : null}
      <AdminButton type="submit" disabled={loading || !identityKey || candidateLoading || Boolean(candidateError)}>{loading ? "開立中…" : "產生點餐網址"}</AdminButton>
      <div className="adminSessionIdentityFeedback" aria-live="polite">
        {identityError ? <p className="adminFormError">{identityError}</p> : null}
        {identityKey ? <p className="adminSessionQualifiedId">顧客 ID：<strong>{identityKey}</strong></p> : null}
        {candidateLoading ? <p>正在查詢相同人物及伺服器的歷史 UID…</p> : null}
        {candidateError ? <div><p className="adminFormError">{candidateError}</p><button type="button" className="adminButton adminButton-secondary" onClick={() => { setResult(null); setCandidateRevision((value) => value + 1); }}>重新查詢 UID</button></div> : null}
        {candidates.length ? <fieldset className="adminIdentityCandidates">
          <legend>相同人物及伺服器的歷史 UID</legend>
          {canManage ? candidates.map((candidate) => <label key={candidate.uid}>
            <input type="radio" name="customerUid" disabled={loading} checked={form.customerUid === candidate.uid} onChange={() => setForm({ ...form, customerUid: candidate.uid })} />
            <span><strong>{candidate.uid}</strong> · {candidate.displayName || "未命名"}<small>最近來店 {candidate.lastVisitAt ? new Date(candidate.lastVisitAt).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" }) : "—"} · {candidate.visitCount} 次入場 · {candidate.orderCount} 張訂單</small></span>
          </label>) : <p>手動選擇既有 UID 需由店經理核對。</p>}
          {canManage ? <button type="button" className="adminButton adminButton-ghost" disabled={loading} onClick={() => setForm({ ...form, customerUid: "" })}>由系統判斷歸戶</button> : null}
        </fieldset> : identityKey && !candidateLoading && !candidateError ? <p>{canManage && form.customerUid ? "將使用經核對的既有 UID。" : "新顧客，將建立 UID。"}</p> : null}
      </div>
    </form>
    {error ? <p className="adminFormError" role="alert">{error}</p> : null}
  </div>;
}
