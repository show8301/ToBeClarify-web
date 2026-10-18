"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/features/admin/api/client.js";
import { AdminButton, AdminDialog, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { AdminDisclosureSummary } from "@/features/admin/shared/AdminDisclosureSummary";
import { confirmRecalculation, getRecalculationHistory, previewRecalculation } from "./recalculation-api";
import { settlementMoney as money, settlementRoles } from "./presentation";
import type { SettlementRun } from "./types";
import type { RecalculationConfirmation, RecalculationHistory, RecalculationPreview } from "./recalculation-types";

type Props = {
  run: SettlementRun;
  saving: boolean;
  onBusyChange: (busy: boolean) => void;
  onRecalculated: () => Promise<boolean>;
};

const delta = (value: number) => `${value > 0 ? "+" : ""}${money(value)} G`;

export function SettlementRecalculation({ run, saving, onBusyChange, onRecalculated }: Props) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<RecalculationPreview | null>(null);
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [history, setHistory] = useState<RecalculationHistory[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const readController = useRef<AbortController | null>(null);
  const historyController = useRef<AbortController | null>(null);
  const operation = useRef<RecalculationConfirmation | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      readController.current?.abort();
      historyController.current?.abort();
    };
  }, []);

  const loadPreview = async () => {
    if (inFlight.current || saving) return;
    inFlight.current = true;
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    setOpen(true); setBusy(true); setError(""); setPreview(null); setChecked(false);
    onBusyChange(true);
    try {
      const next = await previewRecalculation(run.businessDate, run.sessionNo, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setPreview(next); operation.current = null; setUncertain(false);
    } catch (nextError) {
      if (mounted.current && !controller.signal.aborted) setError(nextError instanceof Error ? nextError.message : "無法讀取重新結算預覽。");
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };

  const confirm = async () => {
    if (inFlight.current || !preview || !preview.hasChanges || preview.anomalies.length || !checked || !reason.trim()) return;
    operation.current ??= {
      businessDate: run.businessDate, sessionNo: run.sessionNo, sourceToken: preview.sourceToken,
      expectedCorrectionVersion: preview.correctionVersion, operationId: crypto.randomUUID(), reason: reason.trim(),
    };
    inFlight.current = true;
    setBusy(true); setError(""); onBusyChange(true);
    try {
      await confirmRecalculation(operation.current);
      if (!mounted.current) return;
      setUncertain(false); operation.current = null;
      const refreshed = await onRecalculated();
      if (!mounted.current) return;
      if (refreshed) { setOpen(false); setPreview(null); setReason(""); void loadHistory(); }
      else { setPreview(null); setError("重新結算已完成，頁面尚未取得最新資料，請重新整理。"); }
    } catch (nextError) {
      if (!mounted.current) return;
      const unknown = !(nextError instanceof ApiError) || nextError.status === 0 || nextError.status >= 500;
      setUncertain(unknown);
      if (!unknown) { operation.current = null; setPreview(null); }
      setError(nextError instanceof Error ? nextError.message : "重新結算未完成。");
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };

  const loadHistory = async () => {
    historyController.current?.abort();
    const controller = new AbortController();
    historyController.current = controller;
    setHistoryLoading(true); setHistoryError("");
    try {
      const next = await getRecalculationHistory(run.businessDate, run.sessionNo, controller.signal);
      if (!controller.signal.aborted && mounted.current) setHistory(next);
    } catch (nextError) {
      if (!controller.signal.aborted && mounted.current) setHistoryError(nextError instanceof Error ? nextError.message : "無法讀取歷史版本。");
    } finally {
      if (!controller.signal.aborted && mounted.current) setHistoryLoading(false);
    }
  };
  const canConfirm = Boolean(preview?.hasChanges && !preview.anomalies.length && reason.trim() && checked);

  return <section className="adminSettlementRecalculation" aria-label="結算補正">
    <div className="adminSettlementActionBar">
      <span className="adminFieldHeading">已結算資料補正
        <AdminHelp title="補正後重新結算">依最新出勤與帳款重新計算全員薪資，沿用原結算規則。確認後保存前後快照與原因；已登記支付繼續保留，差額另行補付或追回。</AdminHelp>
      </span>
      <AdminButton variant="secondary" disabled={saving || busy} onClick={() => void loadPreview()}>補正後重新結算</AdminButton>
    </div>
    <details className="adminSettlementDisclosure" onToggle={event => {
      if (event.currentTarget.open && !historyLoading) void loadHistory();
    }}>
      <AdminDisclosureSummary>重新結算紀錄{run.correctionVersion ? ` · 補正版本 ${run.correctionVersion}` : ""}</AdminDisclosureSummary>
      <div className="adminSettlementDisclosureBody">
        {historyLoading ? <p role="status">讀取歷史版本…</p> : null}
        {historyError ? <p role="alert">{historyError} <AdminButton variant="ghost" onClick={() => void loadHistory()}>重新讀取</AdminButton></p> : null}
        {history?.length === 0 ? <p className="adminEmptyText">尚無重新結算紀錄。</p> : null}
        {history?.map(item => <article key={item.id} className="adminSettlementRecalculationHistory">
          <strong>補正版本 {item.version} · 薪資差額 {delta(item.payrollDelta)}</strong>
          <span>{new Date(item.createdAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}</span>
          <p>{item.reason}</p><span>原應付 {money(item.previousPayroll)} G → 補正後 {money(item.correctedPayroll)} G</span>
        </article>)}
      </div>
    </details>
    <AdminDialog open={open} className="adminSettlementRecalculationDialog" title="補正後重新結算"
      description={`${run.businessDate} · 第 ${run.sessionNo} 時段；核對最新出勤與帳款產生的全員差額。`}
      onClose={() => { if (!busy) setOpen(false); }}
      actions={<>
        <AdminButton variant="ghost" disabled={busy} onClick={() => setOpen(false)}>關閉</AdminButton>
        <AdminButton variant="secondary" disabled={busy} onClick={() => void loadPreview()}>重新讀取預覽</AdminButton>
        <AdminButton type="submit" form={formId} disabled={busy || !canConfirm} busy={busy && Boolean(preview)}
          busyLabel="重新結算中…">{uncertain ? "重試確認結果" : "確認重新結算"}</AdminButton>
      </>}>
      <form id={formId} className="adminSettlementRecalculationBody" onSubmit={event => { event.preventDefault(); void confirm(); }} aria-busy={busy}>
        {busy && !preview ? <p role="status">正在核對最新出勤、帳款及既有結算…</p> : null}
        {error ? <p className="adminSettlementInlineWarning" role="alert">{error}</p> : null}
        {uncertain ? <p className="adminSettlementInlineWarning">結果尚未確認，再次確認會沿用同一操作編號。也可重新讀取預覽核對最新結算。</p> : null}
        {preview ? <>
          <div className="adminSettlementSummary">
            <div><span>原應付薪資</span><strong>{money(preview.previousPayroll)} G</strong></div>
            <div><span>補正後應付</span><strong>{money(preview.correctedPayroll)} G</strong></div>
            <div><span>全員薪資差額</span><strong>{delta(preview.payrollDelta)}</strong></div>
          </div>
          <p className="adminSettlementHint">淨實收 {money(preview.previousNetCash)} → {money(preview.correctedNetCash)} G；公司收入 {money(preview.previousCompanyIncome)} → {money(preview.correctedCompanyIncome)} G。</p>
          {!preview.hasChanges ? <p role="status">目前資料與正式結算相同，無需重新結算。</p> : null}
          {preview.anomalies.length ? <div className="adminSettlementInlineWarning" role="alert">
            <strong>請先完成下列補正，再重新讀取預覽</strong>
            <ul>{preview.anomalies.map((item, index) => <li key={`${item.code}-${index}`}>{item.staffName ? `${item.staffName}：` : ""}{item.message}</li>)}</ul>
          </div> : null}
          {preview.changes.length ? <div className="adminSettlementTableWrap">
            <table className="adminSettlementTable adminSettlementRecalculationTable">
              <caption>工時與薪資異動 · {preview.changes.length} 筆</caption>
              <thead><tr><th>人員／角色</th><th>計薪分鐘</th><th>計薪時數</th><th className="adminSettlementNumber">原應付</th><th className="adminSettlementNumber">補正後應付</th><th className="adminSettlementNumber">差額</th></tr></thead>
              <tbody>{preview.changes.map(item => <tr key={`${item.staffId || "company"}-${item.role}`}>
                <td><strong>{item.displayName}</strong><span className="adminSettlementRecalculationRole">{settlementRoles[item.role] || item.role}</span></td>
                <td>{item.previousMinutes ?? "—"} → <strong>{item.correctedMinutes ?? "—"}</strong></td>
                <td>{item.previousHours} → <strong>{item.correctedHours} 小時</strong></td>
                <td className="adminSettlementNumber">{money(item.previousPay)} G</td>
                <td className="adminSettlementNumber"><strong>{money(item.correctedPay)} G</strong></td>
                <td className="adminSettlementNumber">{delta(item.payDelta)}</td>
              </tr>)}</tbody>
            </table>
          </div> : null}
          <details className="adminSettlementDisclosure">
            <AdminDisclosureSummary>補正後各人待補付／需追回金額</AdminDisclosureSummary>
            <div className="adminSettlementDisclosureBody">
              <p className="adminSettlementHint">依補正後應付，加上既有事後差額，扣除已登記淨支付；負數表示需核對追回。本次確認只更新結算，不登記支付。</p>
              <div className="adminSettlementTableWrap"><table className="adminSettlementTable">
                <thead><tr><th>人員</th><th>補正後應付</th><th>既有事後差額</th><th>已登記淨支付</th><th>待補付／需追回</th></tr></thead>
                <tbody>{preview.balances.map(item => <tr key={item.staffId}><td>{item.displayName}</td><td>{money(item.correctedPay)} G</td><td>{delta(item.manualCorrection)}</td><td>{money(item.netPaid)} G</td><td><strong>{item.outstanding < 0 ? "需追回 " : "待補付 "}{money(Math.abs(item.outstanding))} G</strong></td></tr>)}</tbody>
              </table></div>
            </div>
          </details>
          {preview.existingCorrections.length ? <div className="adminSettlementInlineWarning">
            <strong>請核對既有事後差額，避免同一原因重複補正</strong>
            <ul>{preview.existingCorrections.map((item, index) => <li key={index}>{delta(item.amountDelta)} · {item.reason}</li>)}</ul>
          </div> : null}
          <AdminField label="補正原因" required>
            <textarea rows={2} maxLength={500} required value={reason} disabled={busy || uncertain}
              onChange={event => setReason(event.target.value)} placeholder="說明此次出勤或帳款補正的原因" />
          </AdminField>
          <label className="adminSettlementConfirm">
            <input type="checkbox" checked={checked} disabled={busy || uncertain} onChange={event => setChecked(event.target.checked)} />
            我已核對全員差額與既有事後更正，確認建立新的結算版本。
          </label>
        </> : null}
      </form>
    </AdminDialog>
  </section>;
}
