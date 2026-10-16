// Keep this list aligned with the API CharacterIdentity allowlist. The API is
// authoritative; these helpers provide form feedback, never authorization.
export const CHARACTER_SERVERS = [
  "伊弗利特", "利維坦", "奧汀", "巴哈姆特", "泰坦", "迦樓羅", "鳳凰",
] as const;

export type CharacterIdentity = { characterName: string; serverName: string; gameId: string };

function canonicalServer(value: string): string {
  const server = value.trim() === "奧丁" ? "奧汀" : value.trim();
  if (!CHARACTER_SERVERS.some((item) => item === server)) throw new Error("請選擇角色所屬伺服器。");
  return server;
}

export function composeCharacterIdentity(value: string, selectedServer: string): CharacterIdentity {
  const parts = value.trim().replaceAll("＠", "@").split("@");
  const characterName = parts[0].trim().replace(/\s+/g, " ");
  if (!characterName || parts.length > 2) throw new Error("請填寫正確的人物 ID。");
  const serverName = canonicalServer(selectedServer);
  if (parts.length === 2 && canonicalServer(parts[1]) !== serverName) {
    throw new Error("人物 ID 內的伺服器與選單不一致，請核對。");
  }
  const gameId = `${characterName}@${serverName}`;
  if (gameId.length > 100) throw new Error("完整顧客 ID 不得超過 100 字元。");
  return { characterName, serverName, gameId };
}

export function readCharacterIdentity(value: string): CharacterIdentity | null {
  const parts = value.replaceAll("＠", "@").split("@");
  if (parts.length !== 2) return null;
  try { return composeCharacterIdentity(value, parts[1]); }
  catch { return null; }
}
