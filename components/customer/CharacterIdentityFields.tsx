import { CHARACTER_SERVERS, composeCharacterIdentity } from "@/lib/customer-identity";

type Props = {
  gameId: string;
  serverName: string;
  onGameIdChange: (value: string) => void;
  onServerChange: (value: string) => void;
  disabled?: boolean;
  gameIdMaxLength?: number;
  showPreview?: boolean;
};

export function CharacterIdentityFields({ gameId, serverName, onGameIdChange, onServerChange, disabled = false, gameIdMaxLength = 100, showPreview = true }: Props) {
  let preview = "填妥人物 ID 與伺服器後顯示完整顧客 ID。";
  let invalid = false;
  if (gameId.trim() && serverName) {
    try { preview = `完整顧客 ID：${composeCharacterIdentity(gameId, serverName).gameId}`; }
    catch (reason) {
      preview = reason instanceof Error ? reason.message : "請核對人物 ID 與伺服器。";
      invalid = true;
    }
  }
  return <div className="characterIdentityFields">
    <label><span>人物 ID</span><input value={gameId} maxLength={gameIdMaxLength} autoComplete="off" spellCheck={false} required disabled={disabled} aria-invalid={invalid} onChange={(event) => onGameIdChange(event.target.value)} /></label>
    <label><span>角色所屬伺服器</span><select value={serverName} required disabled={disabled} onChange={(event) => onServerChange(event.target.value)}>
      <option value="" disabled>請選擇伺服器</option>
      {CHARACTER_SERVERS.map((server) => <option value={server} key={server}>{server}</option>)}
    </select></label>
    {showPreview ? <p className="characterIdentityPreview" role="status">{preview}</p> : null}
  </div>;
}
