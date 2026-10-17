import { useEffect, useState } from "react";
import { customerApi } from "@/features/admin/customers/api";
import type { CustomerHistoryPage } from "@/features/admin/customers/types";
import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";

export function AdmissionDailyList({ businessDate }: { businessDate: string }) {
  const [page, setPage] = useState(1);
  const key = `${businessDate}:${page}`;
  const [state, setState] = useState<{ key: string; data: CustomerHistoryPage | null; error: string } | null>(null);
  useEffect(() => {
    if (!businessDate) return;
    const c = new AbortController();
    customerApi.history({ businessDate, search: "", page }, c.signal)
      .then((data) => { if (!c.signal.aborted) setState({ key, data, error: "" }); })
      .catch((e: unknown) => { if (!c.signal.aborted) setState({ key, data: null, error: e instanceof Error ? e.message : "入場紀錄讀取失敗。" }); });
    return () => c.abort();
  }, [businessDate, page, key]);
  const current = state?.key === key ? state : null;
  return <section className="adminAdmissionDaily"><h2>當日入場消費紀錄</h2><p>尚未點餐的顧客也列於此處；入場費獨立記帳。</p>
    {!current ? <p role="status">讀取中…</p> : current.error ? <p role="alert">{current.error}</p> : current.data && <>
      {current.data.items.map((visit) => <article key={visit.sessionId}><div><strong>{visit.customerName}</strong><small>{visit.admissionStatus === "unrecorded" ? "入場帳未登錄" : `入場應付 ${visit.admissionReceivable.toLocaleString("zh-TW")} G · 實收 ${visit.admissionReceived.toLocaleString("zh-TW")} G · 實退 ${visit.admissionRefunded.toLocaleString("zh-TW")} G`}</small></div><a className="adminButton adminButton-ghost" href={`/admin/orders?${new URLSearchParams({ date: businessDate, session: visit.sessionId })}`}>顧客帳單</a></article>)}
      {!current.data.items.length && <p>此營業日沒有入場紀錄。</p>}
      <div className="adminPageActions"><AdminButton variant="ghost" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>上一頁</AdminButton><span>第 {page} 頁</span><AdminButton variant="ghost" disabled={page * current.data.pageSize >= current.data.totalCount} onClick={() => setPage((n) => n + 1)}>下一頁</AdminButton></div>
    </>}
  </section>;
}
