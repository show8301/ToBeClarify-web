type Props = { value: unknown };
export function OrderBackfillNotice({ value }: Props) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = Object.fromEntries(Object.entries(value));
  if (typeof row.occurredAt !== "string" || typeof row.recordedAt !== "string" || typeof row.reason !== "string")
    return <p className="adminFormError">補登來源格式不正確，請重新讀取訂單。</p>;
  const format = (time: string) => Number.isFinite(Date.parse(time))
    ? new Date(time).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "時間待確認";
  return <aside className="adminOrderFinanceNotice"><strong>店員補登・已成交／已完成</strong>
    <p>實際發生：{format(row.occurredAt)} · 登記：{format(row.recordedAt)}</p><p>原因：{row.reason}</p>
    <p>{row.linkedCashRecordId ? "已關聯既有收款；本次未新增實收。" : "本次未新增實收，請核對帳款紀錄。"}</p>
  </aside>;
}
