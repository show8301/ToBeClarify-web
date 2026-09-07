"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminPage } from "@/features/admin/shared/AdminShared.jsx";

type Room = {
  id: string;
  roomName: string;
  segmentPrice?: number;
  isActive?: boolean;
};

type RoomOrder = {
  id: string;
  roomName: string;
  startsAt: string;
  endsAt: string;
  segmentCount: number;
  note?: string | null;
  totalAmount?: number;
  status: "scheduled" | "in_service" | "completed" | "cancelled" | string;
};

type RoomServiceForm = {
  roomId: string;
  startsAt: string;
  segmentCount: number;
  note: string;
};

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const money = (value: unknown) => `${Number(value || 0).toLocaleString("zh-TW")} G`;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "包廂服務資料處理失敗。";
}

function statusLabel(status: string) {
  return {
    scheduled: "已預約",
    in_service: "服務中",
    completed: "已完成",
    cancelled: "已取消",
  }[status] || status;
}

export function AdminRoomServicePage() {
  const [message, setMessage] = useState({ text: "", error: false });

  return (
    <AdminPage
      eyebrow="ROOM SERVICE"
      title="包廂服務排程"
      description="管理營業期間的包廂預約與服務狀態；包廂名稱、照片與價格請至包廂內容管理。"
      actions={<AdminButton variant="secondary" onClick={() => setMessage({ text: "", error: false })}>清除提示</AdminButton>}
    >
      {message.text ? <div className={message.error ? "adminOrderMessage isError" : "adminOrderMessage"} role="status">{message.text}</div> : null}
      <AdminRoomServicePanel onMessage={(text, error = false) => setMessage({ text, error })} />
    </AdminPage>
  );
}

function AdminRoomServicePanel({ onMessage }: { onMessage: (text: string, error?: boolean) => void }) {
  const [date, setDate] = useState(today);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [orders, setOrders] = useState<RoomOrder[]>([]);
  const [form, setForm] = useState<RoomServiceForm>({ roomId: "", startsAt: `${today()}T20:00`, segmentCount: 1, note: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomData, orderData] = await Promise.all([
        adminApi.getRooms(),
        adminApi.getRoomOrders({ businessDate: date }),
      ]);
      const nextRooms = (roomData || []) as Room[];
      setRooms(nextRooms);
      setOrders((orderData || []) as RoomOrder[]);
      setForm((current) => ({
        ...current,
        roomId: current.roomId || nextRooms[0]?.id || "",
        startsAt: current.startsAt.startsWith(date) ? current.startsAt : `${date}T20:00`,
      }));
    } catch (error) {
      onMessage(errorMessage(error), true);
    } finally {
      setLoading(false);
    }
  }, [date, onMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const create = async () => {
    if (!form.roomId || !form.startsAt) return;
    setSaving(true);
    try {
      await adminApi.createRoomOrder({
        roomId: form.roomId,
        businessDate: date,
        startsAt: form.startsAt,
        segmentCount: Number(form.segmentCount),
        note: form.note.trim() || null,
      });
      setForm((current) => ({ ...current, note: "" }));
      onMessage("包廂服務訂單已建立。");
      await load();
    } catch (error) {
      onMessage(errorMessage(error), true);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await adminApi.updateRoomOrderStatus(id, status);
      onMessage("包廂服務狀態已更新。");
      await load();
    } catch (error) {
      onMessage(errorMessage(error), true);
    }
  };

  return (
    <section className="adminPanel adminRoomServicePanel">
      <header>
        <div>
          <p className="eyebrow">ROOM SERVICE SCHEDULE</p>
          <h2>營業中的包廂服務</h2>
          <p>這裡同時顯示顧客自助訂購與後台代客建立的包廂時段，每節時間依營運參數計算。</p>
        </div>
        <AdminButton variant="ghost" onClick={() => void load()} disabled={loading}>重新整理</AdminButton>
      </header>

      <div className="adminRoomServiceForm">
        <label>營業日<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>選擇包廂<select value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}><option value="">請選擇</option>{rooms.filter((room) => room.isActive).map((room) => <option key={room.id} value={room.id}>{room.roomName} · {money(room.segmentPrice)}</option>)}</select></label>
        <label>節數<input type="number" min="1" max="72" value={form.segmentCount} onChange={(event) => setForm({ ...form, segmentCount: Number(event.target.value) || 1 })} /></label>
        <label>開始時間<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
        <label>備註<input value={form.note} maxLength={500} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="選填" /></label>
        <AdminButton disabled={saving || loading || !form.roomId} onClick={() => void create()}>{saving ? "建立中…" : "建立包廂服務"}</AdminButton>
      </div>

      <div className="adminRoomServiceRows">
        {orders.map((order) => (
          <article className="adminRoomServiceRow" key={order.id}>
            <strong>{order.roomName}<small>{new Date(order.startsAt).toLocaleString("zh-TW")} ～ {new Date(order.endsAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })}</small></strong>
            <span>{order.segmentCount} 節 · {order.note || "無備註"}</span>
            <b>{money(order.totalAmount)}</b>
            <label className="adminVisuallyHidden" htmlFor={`room-order-status-${order.id}`}>更新 {order.roomName} 狀態</label>
            <select id={`room-order-status-${order.id}`} aria-label={`更新 ${order.roomName} 狀態`} value={order.status} onChange={(event) => void updateStatus(order.id, event.target.value)}>
              {['scheduled', 'in_service', 'completed', 'cancelled'].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </article>
        ))}
        {!orders.length && !loading ? <p className="adminEmptyText">這個營業日尚無包廂服務訂單。</p> : null}
      </div>
    </section>
  );
}
