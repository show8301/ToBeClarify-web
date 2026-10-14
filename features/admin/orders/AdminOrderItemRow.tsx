"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";

interface OrderItem {
  isChampagneTower?: boolean;
  recipientStaffName?: string | null;
  id: string;
  itemType: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface OrderItemRowProps {
  orderId: string;
  item: OrderItem;
  loading: boolean;
  act: (action: () => Promise<unknown>, success: string) => void | Promise<void>;
}

const itemLabels: Record<string, string> = { menu_item: "餐點", nomination_base: "基礎指名", staff_service: "店員服務" };
const money = (value: number) => `${Number(value || 0).toLocaleString("zh-TW")} G`;

export function AdminOrderItemRow({ orderId, item, loading, act }: OrderItemRowProps) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={`adminOrderItemRow${editing ? " isEditing" : ""}`}>
      <span className="adminOrderItemName"><small>{item.isChampagneTower ? "香檳塔" : itemLabels[item.itemType] || item.itemType}</small><strong>{item.name}</strong>{item.isChampagneTower && <small>贈送：{item.recipientStaffName || "店家"} · 不可使用信物折抵</small>}</span>
      <span className="adminOrderItemQuantity" aria-label={`數量 ${item.quantity}`}>× {item.quantity}</span>
      <b>{money(item.lineTotal)}</b>
      <div className="adminOrderItemActions">
        <AdminButton variant="secondary" className="iconActionButton" disabled={loading} aria-label={`${editing ? "收起編輯" : "修改"}：${item.name}`} title={editing ? "收起編輯" : "修改"} aria-expanded={editing} onClick={() => setEditing(!editing)}><Pencil aria-hidden="true" /></AdminButton>
        <AdminButton variant="danger" className="iconActionButton" disabled={loading} aria-label={`刪除：${item.name}`} title="刪除" onClick={() => act(() => adminApi.deleteOrderItem(orderId, item.id), "訂單項目已刪除。")}><Trash2 aria-hidden="true" /></AdminButton>
      </div>
      <OrderItemEditor key={`${item.id}:${item.name}:${item.unitPrice}:${item.quantity}`} orderId={orderId} item={item} loading={loading} act={act} visible={editing} />
    </div>
  );
}

function OrderItemEditor({ orderId, item, loading, act, visible }: OrderItemRowProps & { visible: boolean }) {
  const [form, setForm] = useState({ name: item.name, unitPrice: Number(item.unitPrice), quantity: Number(item.quantity) });
  const locksQuantity = item.itemType === "nomination_base" || item.itemType === "staff_service";
  const save = () => act(
    () => adminApi.updateOrderItem(orderId, item.id, { name: form.name.trim(), unitPrice: Number(form.unitPrice), quantity: locksQuantity ? undefined : Number(form.quantity) }),
    "訂單項目已修改，金額已重新計算並留下稽核紀錄。",
  );
  return (
    <div className="adminOrderItemEditor" hidden={!visible}>
      <label>品名<input value={form.name} maxLength={160} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>單價<input type="number" min="0" max="1000000" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: Number(event.target.value) })} /></label>
      <label>數量<input type="number" min="1" max="99" value={form.quantity} disabled={locksQuantity} title={locksQuantity ? "既有指名不可直接延長，請另開新訂單。" : undefined} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /></label>
      <AdminButton variant="secondary" disabled={loading || !form.name.trim()} onClick={save}>儲存項目</AdminButton>
      {locksQuantity && <small>既有指名不可修改節數；需要追加時數請另開新訂單。</small>}
    </div>
  );
}
