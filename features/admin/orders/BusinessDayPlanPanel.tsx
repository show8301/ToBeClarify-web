"use client";

import { useEffect, useState } from "react";
import { adminRequest } from "@/features/admin/api/client.js";

interface Plan { businessDate: string; startsAt: string; endsAt: string; version: number; isSaved: boolean; isOpened: boolean }
function parsePlan(value: unknown): Plan {
  if (!value || typeof value !== "object") throw new Error("無法讀取營業計畫。");
  const p = Object.fromEntries(Object.entries(value));
  if (typeof p.businessDate !== "string" || typeof p.startsAt !== "string" || typeof p.endsAt !== "string" || typeof p.version !== "number" || typeof p.isSaved !== "boolean" || typeof p.isOpened !== "boolean") throw new Error("營業計畫資料格式有誤。");
  return { businessDate: p.businessDate, startsAt: p.startsAt, endsAt: p.endsAt, version: p.version, isSaved: p.isSaved, isOpened: p.isOpened };
}
const inputTime = (value: string) => new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 16);

export function BusinessDayPlanPanel({ businessDate, onOpened }: { businessDate: string; onOpened: () => Promise<unknown> }) {
  const [date, setDate] = useState(businessDate);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [flow2, setFlow2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState<{ action: "save" | "open"; path: string; body: object } | null>(null);
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    adminRequest(`/business-day-plans/${date}`, { signal: controller.signal }).then((value: unknown) => {
      const p = parsePlan(value); setPlan(p); setStartsAt(inputTime(p.startsAt)); setEndsAt(inputTime(p.endsAt));
    }).catch((e: Error) => { if (!controller.signal.aborted) setMessage(e.message); });
    return () => controller.abort();
  }, [date]);
  const run = async (action: "save" | "open") => {
    if (!plan) return;
    const request = retry ?? {
      action, path: action === "save" ? `/business-day-plans/${date}` : "/business-period/open",
      body: action === "save" ? { startsAt: `${startsAt}:00+08:00`, endsAt: `${endsAt}:00+08:00`, expectedVersion: plan.version, operationId: crypto.randomUUID() }
        : { businessDate: date, projectedCloseAt: endsAt, flowVersion: flow2 ? 2 : 1, operationId: crypto.randomUUID(), reason: "現場手動開店" },
    };
    setRetry(request); setBusy(true); setMessage("");
    try {
      const result: unknown = await adminRequest(request.path, { method: request.action === "save" ? "PUT" : "POST", body: JSON.stringify(request.body) });
      setRetry(null);
      if (request.action === "save") { setPlan(parsePlan(result)); setMessage("已儲存營業計畫；到時仍須手動開店。"); }
      else { setPlan({ ...plan, isOpened: true }); setMessage("已開店。"); await onOpened(); }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "操作失敗");
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number" && e.status >= 400 && e.status < 500) setRetry(null);
    } finally { setBusy(false); }
  };
  return <section className="adminBusinessOperations">
    <h3>每日營業計畫與開店</h3>
    <p>時間以台灣時間填寫，跨午夜請選正確的結束日期。計畫不會自動開店。</p>
    <fieldset disabled={busy || !!retry} className="adminBusinessOperationsControls">
      <label>營業日<input type="date" value={date} onChange={e => { setPlan(null); setDate(e.target.value); }} /></label>
      <label>預定開始<input type="datetime-local" value={startsAt} disabled={plan?.isOpened} onChange={e => setStartsAt(e.target.value)} /></label>
      <label>預定結束<input type="datetime-local" value={endsAt} disabled={plan?.isOpened} onChange={e => setEndsAt(e.target.value)} /></label>
      {plan && !plan.isOpened && <>
        <button type="button" disabled={!startsAt || !endsAt} onClick={() => void run("save")}>儲存計畫</button>
        <label><input type="checkbox" checked={flow2} onChange={e => setFlow2(e.target.checked)} />本營業日使用分項接待及現場帳款</label>
        {flow2 && <p>分項接待與現場帳款可用；關店後由帳目／薪資結算入口核對實收、保留分潤並完成正式結算。</p>}
        <button type="button" disabled={!plan.isSaved || startsAt !== inputTime(plan.startsAt) || endsAt !== inputTime(plan.endsAt)} onClick={() => void run("open")}>現在開店</button>
      </>}
      {plan?.isOpened && <p>此營業日已開過店，原始計畫保留。請由營業控制調整關店時間。</p>}
    </fieldset>
    {message && <p role="status">{message}</p>}
    {retry && <button type="button" disabled={busy} onClick={() => void run(retry.action)}>查回／重試同一筆操作</button>}
  </section>;
}
