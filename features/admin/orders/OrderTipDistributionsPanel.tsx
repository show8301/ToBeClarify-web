"use client";

import { useEffect, useState } from "react";
import { AdminButton, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { ApiError } from "@/features/admin/api/client.js";
import { financeApi } from "./finance-api";
import { FINANCE_UPDATED, isFinanceUpdateFor, notifyFinanceUpdated } from "./finance-events";
import { orderTipApi } from "./order-tip-api";
import type { OrderTip, TipCorrection } from "./order-tip-api";
import type { FinanceAccount, FinanceTipStaffOption } from "./finance-types";
import { TipDistributionFields } from "./TipDistributionFields";
import type { TipDistributionInput } from "./TipDistributionFields";

const money = (n: number) => `${n.toLocaleString("zh-TW")} G`;
const labels = { public: "公共小費（按工時分配）", equal: "舊版人頭均分", designated: "指定店員", custom: "自訂比例" };
type Props = {
  sessionId: string; refreshKey: string; onSaved: () => Promise<void>;
};

export function OrderTipDistributionsPanel(props: Props) {
  return <TipDistributions key={props.sessionId} {...props} />;
}

function TipDistributions({ sessionId, refreshKey, onSaved }: Props) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${refreshKey}|${revision}`;
  const [data, setData] = useState<{ key: string; tips: OrderTip[]; staff: FinanceTipStaffOption[]; account: FinanceAccount } | null>(null);
  const [editing, setEditing] = useState<OrderTip | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const loading = data?.key !== requestKey && error?.key !== requestKey;
  const visibleError = error?.key === requestKey ? error.message : "";
  useEffect(() => {
    const handler = (event: Event) => { if (isFinanceUpdateFor(event, sessionId)) setRevision(n => n + 1); };
    window.addEventListener(FINANCE_UPDATED, handler);
    return () => window.removeEventListener(FINANCE_UPDATED, handler);
  }, [sessionId]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([orderTipApi.list(sessionId, controller.signal), financeApi.tipStaff(sessionId, controller.signal), financeApi.account(sessionId, controller.signal)])
      .then(([tips, staff, account]) => { if (!controller.signal.aborted) { setData({ key: requestKey, tips, staff, account }); setError(null); } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError({ key: requestKey, message: e instanceof Error ? e.message : "小費資料讀取失敗。" }); });
    return () => controller.abort();
  }, [sessionId, requestKey]);
  return <section className="adminOrderCard adminOrderTipPanel" aria-label="訂單小費分配" aria-busy={loading}>
    <header className="adminOrderFinanceHeading">
      <div className="adminFieldHeading">
        <h3>訂單小費分配</h3>
        <AdminHelp title="小費訂單與帳款">新增小費請使用「補登已成交訂單」，再到帳款登記實收。此處只更正原訂單的分配，不增加應收或實收；薪資依有效收款認列。</AdminHelp>
      </div>
      <AdminButton variant="ghost" disabled={loading || editing !== null} onClick={() => setRevision(n => n + 1)}>重新讀取分配</AdminButton>
    </header>
    {visibleError && <p className="adminOrderFinanceNotice isError" role="alert">{visibleError}</p>}
    {loading && <p className="adminOrderTipStatus" role="status">正在讀取小費分配…</p>}
    {data?.tips.length === 0 && !loading && <p className="adminOrderFinanceEmpty">尚無小費訂單。</p>}
    <details className="adminOrderTipDisclosure" open>
      <AdminDisclosureSummary>小費分配明細{data ? ` · ${data.tips.length} 筆 · 合計 ${money(data.tips.reduce((total, tip) => total + tip.amount, 0))}` : ""}{editing ? " · 更正中" : ""}</AdminDisclosureSummary>
    <div className="adminOrderTipList">{data?.tips.map(tip => <article key={tip.itemId} className="adminOrderTipCard">
      <header className={`adminOrderTipSummary${data.account.canWrite && !editing ? " hasAction" : ""}`}>
        <div className="adminOrderTipIdentity">
          <a href={`#admin-order-${encodeURIComponent(tip.orderId)}`}>訂單 {tip.orderNumber}</a>
          <div className="adminOrderTipTags">
            <span className="adminOrderFinanceTag">{tip.distribution ? labels[tip.distribution.mode] : "原訂單分配"}</span>
            <span>分配版本 {tip.version}</span>
          </div>
        </div>
        <dl className="adminOrderTipAmount"><div><dt>小費總額</dt><dd>{money(tip.amount)}</dd></div></dl>
        {data.account.canWrite && !editing && <AdminButton variant="secondary" disabled={loading || !!visibleError} onClick={() => setEditing(tip)}>更正此筆分配</AdminButton>}
      </header>
      {tip.distribution?.mode === "public" ? <p className="adminOrderTipStatus">於結算依合資格計薪工時分配</p> : tip.distribution ? <ul className="adminOrderTipAllocations">{tip.distribution.allocations.map(a => <li key={a.staffId}>
        <span>{a.staffName}{a.percentage === null ? "" : `（${a.percentage}%）`}</span><strong>{money(a.amount)}</strong>
      </li>)}</ul> : <dl className="adminOrderTipOriginal">
        <div><dt>{tip.staffName ? `${tip.staffName}・員工份額` : "員工份額"}</dt><dd>{money(tip.staffAmount)}</dd></div>
        <div><dt>原店家份額</dt><dd>{money(tip.storeAmount)}</dd></div>
      </dl>}
      {tip.distribution && tip.distribution.mode !== "public" && tip.distribution.publicAmount > 0 && <p className="adminOrderTipStatus">另有公共小費 <strong>{money(tip.distribution.publicAmount)}</strong>，於結算按工時分配。</p>}
      {editing?.itemId === tip.itemId && <Correction key={tip.itemId} tip={editing} account={data.account} staff={data.staff}
        onCancel={() => setEditing(null)} onSaved={async () => { await onSaved(); setEditing(null); setRevision(n => n + 1); }} />}
    </article>)}</div>
    </details>
  </section>;
}

function Correction({ tip, account, staff, onCancel, onSaved }: {
  tip: OrderTip; account: FinanceAccount; staff: FinanceTipStaffOption[]; onCancel: () => void; onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState<TipDistributionInput>(() => ({ mode: tip.distribution?.mode === "equal" ? "public" : tip.distribution?.mode ?? "public",
    allocations: tip.distribution?.mode === "equal" ? [] : tip.distribution?.allocations.map(a => ({ staffId: a.staffId, percentage: a.percentage }))
      ?? [] }));
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
  return <form className="adminOrderTipCorrection" aria-label={`更正訂單 ${tip.orderNumber} 小費分配`} onSubmit={e => { e.preventDefault(); void save(); }}>
    <header className="adminFieldHeading">
      <h4>更正分配</h4>
      <AdminHelp title="更正分配的影響">原分配將被取代並保留歷程。小費總額、應收與實收不變；已正式結算的薪資需由經理重新結算後才更新。</AdminHelp>
    </header>
    <fieldset className="adminOrderTipCorrectionFields" disabled={busy || !!retry || saved}>
      <TipDistributionFields value={value} staff={staff} onChange={setValue} />
      <AdminField label="更正原因" required><textarea required rows={2} maxLength={500} value={reason}
        placeholder="說明原分配的問題與本次更正原因" onChange={e => setReason(e.target.value)} /></AdminField>
    </fieldset>
    {!tip.distribution && tip.storeAmount > 0 && <p className="adminOrderFinanceNotice" role="alert">原店家份額 {money(tip.storeAmount)} 將依本次選擇改為員工分配，請確認歸屬。</p>}
    {error && <p className="adminOrderFinanceNotice isError" role="alert">{saved ? "已儲存分配，請重新讀取，勿再次新增。" : error}</p>}
    <footer className="adminOrderFinanceActions adminOrderTipActions">
      <AdminButton variant="ghost" disabled={busy || !!retry || saved} onClick={onCancel}>取消</AdminButton>
      <AdminButton type="submit" busy={busy} busyLabel="處理中…" disabled={busy || (!retry && !saved && !reason.trim())}>{saved ? "重新讀取" : retry ? "查回／重試原更正" : "確認更正分配"}</AdminButton>
    </footer>
  </form>;
}
