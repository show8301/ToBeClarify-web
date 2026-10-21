"use client";

import { useEffect, useState } from "react";
import { AdminButton } from "@/features/admin/shared/AdminButton";
import { ApiError } from "@/features/admin/api/client.js";
import { financeApi } from "./finance-api";
import { FINANCE_UPDATED, isFinanceUpdateFor, notifyFinanceUpdated } from "./finance-events";
import { orderTipApi } from "./order-tip-api";
import type { OrderTip, TipCorrection } from "./order-tip-api";
import type { FinanceAccount, FinanceTipStaffOption } from "./finance-types";
import { TipDistributionFields } from "./TipDistributionFields";
import type { TipDistributionInput } from "./TipDistributionFields";

const money = (n: number) => `${n.toLocaleString("zh-TW")} G`;
const labels = { equal: "上班員工均分", designated: "指定店員", custom: "自訂比例" };
export function OrderTipDistributionsPanel({ sessionId, refreshKey, onSaved }: {
  sessionId: string; refreshKey: string; onSaved: () => Promise<void>;
}) {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ tips: OrderTip[]; staff: FinanceTipStaffOption[]; account: FinanceAccount } | null>(null);
  const [editing, setEditing] = useState<OrderTip | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const handler = (event: Event) => { if (isFinanceUpdateFor(event, sessionId)) setRevision(n => n + 1); };
    window.addEventListener(FINANCE_UPDATED, handler);
    return () => window.removeEventListener(FINANCE_UPDATED, handler);
  }, [sessionId]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([orderTipApi.list(sessionId, controller.signal), financeApi.tipStaff(sessionId, controller.signal), financeApi.account(sessionId, controller.signal)])
      .then(([tips, staff, account]) => { if (!controller.signal.aborted) { setData({ tips, staff, account }); setError(""); } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "小費資料讀取失敗。"); });
    return () => controller.abort();
  }, [sessionId, refreshKey, revision]);
  return <section className="adminOrderCard" aria-label="訂單小費分配">
    <header className="adminOrderFinanceHeading"><h3>訂單小費分配</h3><AdminButton variant="ghost" onClick={() => setRevision(n => n + 1)}>重新讀取分配</AdminButton></header>
    <p>新增小費請使用「補登已成交訂單」，再到帳款登記實收。此處更正原訂單的分配，不增加應收或實收；結算依有效收款認列。</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">正在讀取小費訂單…</p>}
    {data?.tips.length === 0 && <p>尚無小費訂單。</p>}
    {data?.tips.map(tip => <article key={tip.itemId} className="adminOrderBackfillLine">
      <a href={`#admin-order-${encodeURIComponent(tip.orderId)}`}>訂單 {tip.orderNumber}</a>
      <p>小費 {money(tip.amount)} · 分配版本 {tip.version} · {tip.distribution ? labels[tip.distribution.mode] : "原訂單分配"}</p>
      {tip.distribution ? <ul>{tip.distribution.allocations.map(a => <li key={a.staffId}>
        {a.staffName}：{money(a.amount)}{a.percentage === null ? "" : `（${a.percentage}%）`}
      </li>)}</ul> : <p>{tip.staffName || "店家"}：員工 {money(tip.staffAmount)}／店家 {money(tip.storeAmount)}</p>}
      {data.account.canWrite && !editing && <AdminButton variant="secondary" onClick={() => setEditing(tip)}>更正此筆分配</AdminButton>}
      {editing?.itemId === tip.itemId && <Correction key={tip.itemId} tip={editing} account={data.account} staff={data.staff}
        onCancel={() => setEditing(null)} onSaved={async () => { await onSaved(); setEditing(null); setRevision(n => n + 1); }} />}
    </article>)}
  </section>;
}

function Correction({ tip, account, staff, onCancel, onSaved }: {
  tip: OrderTip; account: FinanceAccount; staff: FinanceTipStaffOption[]; onCancel: () => void; onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState<TipDistributionInput>(() => ({ mode: tip.distribution?.mode ?? "equal",
    allocations: tip.distribution?.allocations.map(a => ({ staffId: a.staffId, percentage: a.percentage }))
      ?? staff.map(x => ({ staffId: x.staffId, percentage: null })) }));
  const [reason, setReason] = useState("");
  const [retry, setRetry] = useState<TipCorrection | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      if (!saved) {
        const body = retry ?? { ...value, operationId: crypto.randomUUID(), expectedAccountVersion: account.version,
          expectedDistributionVersion: tip.version, reason: reason.trim() };
        setRetry(body);
        const prior = await financeApi.operation(account.sessionId, body.operationId);
        if (!prior) await orderTipApi.correct(account.sessionId, tip.itemId, body);
        setSaved(true);
        notifyFinanceUpdated(`/ordering-finance/sessions/${encodeURIComponent(account.sessionId)}`);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存結果尚未確認。");
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) setRetry(null);
    } finally { setBusy(false); }
  }
  return <form onSubmit={e => { e.preventDefault(); void save(); }}>
    <fieldset disabled={busy || !!retry || saved}>
      <TipDistributionFields value={value} staff={staff} onChange={setValue} />
      <label>更正原因<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
    </fieldset>
    <p>原分配將被本次分配取代，保留修改歷程。小費總額 {money(tip.amount)}、應收與實收不變；已正式結算需由經理重新結算。</p>
    {tip.storeAmount > 0 && <p role="alert">原分配包含店家 {money(tip.storeAmount)}；確認後本筆小費將全額分配給所選員工。</p>}
    {error && <p role="alert">{saved ? "已儲存分配，請重新讀取，勿再次新增。" : error}</p>}
    <AdminButton type="submit" disabled={busy || (!retry && !saved && !reason.trim())}>{saved ? "重新讀取" : retry ? "查回／重試原更正" : "確認更正分配"}</AdminButton>
    <AdminButton variant="ghost" disabled={busy || !!retry || saved} onClick={onCancel}>取消</AdminButton>
  </form>;
}
