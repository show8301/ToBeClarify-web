"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/features/admin/api/client.js";
import { AdminButton, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { formatMoney } from "./operationsFormat";
import { errorText, integer, list, record, textValue } from "./workbenchApi";
import type { ServiceEntry } from "./WorkbenchServiceDialog";
type Option = { id: string; name: string; price: number; duration: number; extraPrice: number };

export function WorkbenchAddonForm({ entry, onSaved, onBusy }: { entry: ServiceEntry; onSaved: () => Promise<void>; onBusy: (busy: boolean) => void }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceId, setServiceId] = useState("");
  const [segments, setSegments] = useState(1);
  const [participants, setParticipants] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const [submitted, setSubmitted] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    adminApi.getAddonOptions(entry.nominee.id, controller.signal).then((value: unknown) => {
      const next = list(value, (item) => { const s = record(item); return { id: textValue(s.id), name: textValue(s.serviceName), price: integer(s.price), duration: s.durationMinutes == null ? 0 : integer(s.durationMinutes), extraPrice: s.additionalPersonPrice == null ? 0 : integer(s.additionalPersonPrice) }; });
      if (!controller.signal.aborted) { setOptions(next); setLoading(false); }
    }).catch((e: unknown) => { if (!controller.signal.aborted) { setError(errorText(e)); setLoading(false); } });
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [entry.nominee.id]);
  const option = options.find((s) => s.id === serviceId);
  const segmentMinutes = entry.nominee.segmentMinutes || 20;
  const remaining = Math.max(0, Math.floor((Date.parse(entry.unit?.scheduledEndsAt || entry.nominee.requestedServiceEndsAt) - Math.max(now, Date.parse(entry.unit?.scheduledStartsAt || entry.nominee.requestedStartsAt))) / 60_000));
  const minimum = option?.duration ? Math.ceil(option.duration / segmentMinutes) : 1;
  const count = option?.duration ? minimum : segments;
  const duration = option?.duration || count * segmentMinutes;
  const amount = option ? (option.price + (participants - 1) * option.extraPrice) * (option.duration ? 1 : count) : 0;
  const save = async () => {
    if (lock.current || submitted) return;
    lock.current = true; setBusy(true); onBusy(true); setError("");
    try {
      await adminApi.submitAdminAddon(entry.nominee.id, { serviceId, segmentCount: count, participantCount: participants });
      setSubmitted(true);
      await onSaved();
    } catch (e) {
      setError(errorText(e));
      const knownRejection = e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500;
      setUncertain(!knownRejection);
    }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <form className="dwForm" onSubmit={(e) => { e.preventDefault(); void save(); }}>
    <p className="dwHint">可用約 {remaining} 分鐘。加購直接成立，不增加基礎指名費，也不延長原指名時間。</p>
    {loading && <p role="status">載入可加購服務…</p>}
    {!loading && !options.length && !error && <p>目前沒有可附掛服務。</p>}
    <fieldset disabled={busy || loading || submitted || uncertain}>
      <AdminField label="服務" required><select required value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSegments(1); }}><option value="">選擇服務</option>{options.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatMoney(s.price)}{s.duration ? `／${s.duration} 分鐘` : "／節"}</option>)}</select></AdminField>
      <div className="dwFormGrid">
        <AdminField label="節數" required><input required disabled={Boolean(option?.duration)} type="number" min={minimum} max={Math.floor(remaining / segmentMinutes)} value={count} onChange={(e) => setSegments(Number(e.target.value))} /></AdminField>
        <AdminField label="人數" required><input required type="number" min={1} max={20} value={participants} onChange={(e) => setParticipants(Number(e.target.value))} /></AdminField>
      </div>
    </fieldset>
    {option && <p className="dwNotice">{duration} 分鐘 · {formatMoney(amount)}{duration > remaining ? " · 超過原指名剩餘時間，請改用續時" : ""}</p>}
    {error && <p className="adminFormError" role="alert">{error} 若連線中斷，請先關閉並重新整理，確認是否已成立。</p>}
    <AdminButton type="submit" disabled={busy || loading || !option || duration > remaining || submitted || uncertain}>{busy ? "送出中…" : uncertain ? "請先關閉並重新整理確認" : "確認並建立加購"}</AdminButton>
  </form>;
}
