export type DeliveryItem = { menuItemName: string; gameItemName: string | null; quantityPerUnit: number };

export function parseDeliveryItems(value: unknown): DeliveryItem[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("送餐品項資料格式異常。");
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("menuItemName" in item) || typeof item.menuItemName !== "string" ||
      !("quantityPerUnit" in item) || typeof item.quantityPerUnit !== "number" || !Number.isSafeInteger(item.quantityPerUnit) || item.quantityPerUnit < 1 ||
      !("gameItemName" in item) || (item.gameItemName !== null && typeof item.gameItemName !== "string")) throw new Error("送餐品項資料格式異常。");
    return { menuItemName: item.menuItemName, gameItemName: item.gameItemName, quantityPerUnit: item.quantityPerUnit };
  });
}

export function DeliveryItems({ items }: { items: DeliveryItem[] }) {
  if (!items.length) return <div>遊戲內品項：尚未取得，請確認餐點內容。</div>;
  return <div>遊戲內品項（每份，依目前設定）：{items.map((item, index) =>
    <span key={index}>{index > 0 ? "、" : ""}{item.gameItemName || `未設定（${item.menuItemName}）`}{item.quantityPerUnit > 1 ? ` × ${item.quantityPerUnit}` : ""}</span>)}</div>;
}
