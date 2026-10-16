import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { CharacterIdentityFields } from "@/components/customer/CharacterIdentityFields";
import { composeCharacterIdentity, readCharacterIdentity } from "@/lib/customer-identity";

type Props = {
  currentGameId?: string;
  loading: boolean;
  onRecover: (gameId: string, recoveryCode: string, serverName?: string) => Promise<void>;
};

export function OrderRecoveryForm({ currentGameId = "", loading, onRecover }: Props) {
  const initial = readCharacterIdentity(currentGameId);
  const [gameId, setGameId] = useState(initial?.characterName || currentGameId);
  const [serverName, setServerName] = useState(initial?.serverName || "");
  const [legacy, setLegacy] = useState(Boolean(currentGameId && !initial));
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || submitting.current) return;
    setError("");
    submitting.current = true;
    try {
      if (legacy) {
        if (!gameId.trim() || /[@＠]/.test(gameId)) throw new Error("舊資料找回請填寫原本未含伺服器的人物 ID。");
        await onRecover(gameId.trim(), recoveryCode);
      } else {
        const identity = composeCharacterIdentity(gameId, serverName);
        await onRecover(identity.characterName, recoveryCode, identity.serverName);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法找回點餐碼。"); }
    finally { submitting.current = false; }
  }

  return <form className="orderRecoveryForm" onSubmit={(event) => { void submit(event); }}>
    {legacy ? <label>原人物 ID<input value={gameId} maxLength={100} required disabled={loading} onChange={(event) => setGameId(event.target.value)} /></label>
      : <CharacterIdentityFields gameId={gameId} serverName={serverName} onGameIdChange={setGameId} onServerChange={setServerName} disabled={loading} />}
    <label>六位數店員協助碼<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={recoveryCode} disabled={loading} required autoComplete="off" onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, ""))} /></label>
    {error ? <p role="alert">{error}</p> : null}
    <button type="submit" disabled={loading}>{loading ? "找回中…" : "找回今日點餐碼"}</button>
    <label className="orderLegacyRecovery"><input type="checkbox" checked={legacy} disabled={loading} onChange={(event) => { setLegacy(event.target.checked); setError(""); setRecoveryCode(""); }} />舊點餐碼未記錄伺服器</label>
    {legacy ? <p>僅供原本未記錄伺服器的舊點餐碼使用；請輸入當時的人物 ID 與店員協助碼。</p> : <p>請選擇角色所屬伺服器；找不到資料時請洽店員核對。</p>}
  </form>;
}
