import { useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import type { OperationsRoomOrder } from "./operationsTypes";

export function StandaloneRoomTask({ room, date, now, disabled, navigate, onBusy, onChanged }: {
  room: OperationsRoomOrder; date: string; now: number; disabled: boolean; navigate: (route: string) => void;
  onBusy: (busy: boolean) => void; onChanged: () => Promise<void>;
}) {
  const lock = useRef(false);
  const [error, setError] = useState("");
  const action = room.status === "scheduled" ? "in_service" : "completed";
  const early = Date.parse(action === "in_service" ? room.startsAt : room.endsAt) > now;
  const save = async () => {
    if (lock.current || disabled || early) return;
    lock.current = true; onBusy(true); setError("");
    try { await adminApi.updateRoomOrderStatus(room.id, action); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "包廂狀態更新失敗，請重整確認。"); }
    finally { lock.current = false; onBusy(false); }
  };
  return <article className="serviceTaskRow"><div className="serviceTaskHead"><div><strong>{room.roomName} · 獨立包廂預約</strong><small>{room.status === "in_service" ? "使用中" : "已預約"} · {new Date(room.startsAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })} ～ {new Date(room.endsAt).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei" })}</small><small>{room.note || "無備註"}</small></div>
    <div className="serviceTaskActions"><AdminButton disabled={disabled || early} disabledReason={early ? "尚未到預定時間；例外處理請進入包廂管理。" : undefined} onClick={() => void save()}>{action === "in_service" ? "開始使用" : "確認使用完成"}</AdminButton><AdminButton variant="ghost" disabled={disabled} onClick={() => navigate(`/admin/rooms/service?${new URLSearchParams({ date })}`)}>完整包廂管理</AdminButton></div></div>{error && <p role="alert">{error}</p>}</article>;
}
