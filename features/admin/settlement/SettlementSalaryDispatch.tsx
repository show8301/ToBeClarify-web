import { useEffect, useRef, useState } from "react";
import { AdminButton, AdminDialog, AdminPanel, AdminState } from "@/features/admin/shared/AdminShared.jsx";
import { AdminRefreshButton } from "@/features/admin/shared/AdminRefreshButton";
import { getSalaryDispatch, saveSalaryDispatch } from "./salary-dispatch-api";
import type { SalaryDispatch, SalaryDispatchItem } from "./salary-dispatch-types";
import { settlementMoney as money } from "./presentation";

type Props = { businessDate: string; sessionNo: number; onBusyChange: (busy: boolean) => void };

function updateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "薪資派發資料暫時無法載入。";
}

export function SettlementSalaryDispatch({ businessDate, sessionNo, onBusyChange }: Props) {
  const [data, setData] = useState<SalaryDispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<SalaryDispatchItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  const reload = () => {
    if (inFlight.current) return;
    setLoading(true);
    setError("");
    setMessage("");
    setSelected(null);
    setRevision(value => value + 1);
  };

  useEffect(() => {
    const next = new AbortController();
    controller.current = next;
    getSalaryDispatch(businessDate, sessionNo, next.signal).then(result => {
      if (!next.signal.aborted) setData(result);
    }).catch((nextError: unknown) => {
      if (!next.signal.aborted) { setData(null); setError(errorMessage(nextError)); }
    }).finally(() => {
      if (!next.signal.aborted) setLoading(false);
    });
    return () => { next.abort(); onBusyChange(false); };
  }, [businessDate, sessionNo, revision, onBusyChange]);

  const confirm = async () => {
    if (inFlight.current || !selected || !data?.finalized || !data.settlementId || loading) return;
    const current = controller.current;
    if (!current || current.signal.aborted) return;
    inFlight.current = true;
    setSaving(true);
    onBusyChange(true);
    setMessage("");
    const signal = current.signal;
    let feedback = "";
    try {
      await saveSalaryDispatch({
        businessDate, sessionNo, settlementId: data.settlementId, staffId: selected.staffId,
        isPaid: !selected.isPaid, expectedVersion: selected.version,
        expectedCorrectionVersion: data.correctionVersion, expectedInputVersion: data.inputVersion,
        operationId: crypto.randomUUID(),
      }, signal);
      feedback = `${selected.displayName} 已標記為「${selected.isPaid ? "未給" : "已給"}」。`;
    } catch (nextError) {
      feedback = `${errorMessage(nextError)} 請核對重新載入的狀態，系統不會自動重送。`;
    }
    // Read back even after a failed/uncertain mutation; never blindly retry a status change.
    try {
      const refreshed = await getSalaryDispatch(businessDate, sessionNo, signal);
      if (!signal.aborted) { setData(refreshed); setMessage(feedback); setSelected(null); }
    } catch (nextError) {
      if (!signal.aborted) {
        setData(null); setSelected(null);
        setError(`${feedback} 目前無法確認最新狀態：${errorMessage(nextError)} 請重新載入後再操作。`);
      }
    } finally {
      inFlight.current = false;
      if (!signal.aborted) { setSaving(false); onBusyChange(false); }
    }
  };

  const paidCount = data?.items.filter(item => item.isPaid).length ?? 0;
  const items = data?.items ?? [];
  return <AdminPanel
    title="薪資派發"
    description="記錄本次營業結算的薪資是否已給，不會轉帳，也不會新增支付、追回或金額更正。"
    actions={<AdminRefreshButton loading={loading} disabled={loading || saving} onClick={reload} />}
  >
    <p className="adminSettlementHint">應發薪資以最新正式結算為準；重新結算不會重設「已給／未給」標記，也不會自動核對差額。</p>
    {message ? <p className="adminNotice" role="status">{message}</p> : null}
    <AdminState loading={loading} error={error ? new Error(error) : null} onRetry={reload} />
    {!loading && !error && data ? !data.finalized
      ? <p className="adminEmptyText">本營業時段尚未正式結算，完成正式結算後即可登記薪資派發。</p>
      : <>
        <div className="adminSalaryDispatchProgress" aria-label="薪資派發進度">
          <span>已給 <strong>{paidCount}</strong> 人</span>
          <span>未給 <strong>{items.length - paidCount}</strong> 人</span>
          <span>共 {items.length} 人</span>
        </div>
        {items.length ? <ul className="adminSalaryDispatchList" aria-label="本次薪資派發清單" aria-busy={saving}>
          {items.map(item => <li className="adminSalaryDispatchRow" key={item.staffId}>
            <div className="adminSalaryDispatchPerson">
              <strong>{item.displayName}</strong>
              <small>{item.updatedAt
                ? `最後登記：${item.updatedByName || item.updatedBy || "管理者"} · ${updateTime(item.updatedAt)}`
                : "尚未登記派發"}</small>
            </div>
            <div className="adminSalaryDispatchAmount"><span>應發薪資</span><strong>{money(item.salary)} G</strong></div>
            <span className="adminSettlementBadge adminSalaryDispatchStatus" data-paid={item.isPaid}>{item.isPaid ? "已給" : "未給"}</span>
            <AdminButton variant={item.isPaid ? "secondary" : "primary"} disabled={saving} onClick={() => setSelected(item)}
              aria-label={`${item.displayName}：${item.isPaid ? "改回未給" : "標記已給"}`}>
              {item.isPaid ? "改回未給" : "標記已給"}
            </AdminButton>
          </li>)}
        </ul> : <p className="adminEmptyText">本次結算沒有可登記薪資派發的人員。</p>}
      </> : null}
    {selected ? <AdminDialog
      open title={selected.isPaid ? "改回未給" : "標記已給"}
      description="只更新人工派發標記，操作人、時間與狀態變更會保留。"
      onClose={() => { if (!inFlight.current) setSelected(null); }}
      actions={<>
        <AdminButton variant="ghost" disabled={saving} onClick={() => setSelected(null)}>取消</AdminButton>
        <AdminButton busy={saving} busyLabel="儲存中…" onClick={() => void confirm()}>確認{selected.isPaid ? "改回未給" : "已給"}</AdminButton>
      </>}
    >
      <dl className="adminSettlementDefinitionList">
        <div><dt>店員</dt><dd>{selected.displayName}</dd></div>
        <div><dt>營業日期／時段</dt><dd>{businessDate} · 第 {sessionNo} 時段</dd></div>
        <div><dt>目前應發薪資</dt><dd>{money(selected.salary)} G</dd></div>
      </dl>
    </AdminDialog> : null}
  </AdminPanel>;
}
