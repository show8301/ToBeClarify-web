import { useState } from "react";
import { AdminButton, AdminDialog, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdmissionSummary } from "@/features/admin/orders/AdmissionSummary";
import { WorkbenchOrderComposer } from "./WorkbenchOrderComposer";
import { WorkbenchDepartureAction, WorkbenchPassAction } from "./WorkbenchGuestActions";
import { ServiceOrderDetail } from "./ServiceOrderDetail";
import type { CurrentAdminUser, OperationsData } from "./operationsTypes";
import type { WorkbenchUnit } from "./workbenchApi";

export function ServiceGuestPanel({ data, user, units, selectedId, onSelect, disabled, onBusy, onChanged }: {
  data: OperationsData; user?: CurrentAdminUser; units: Record<string, WorkbenchUnit[]>; selectedId: string;
  onSelect: (id: string) => void; disabled: boolean; onBusy: (busy: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const [dialog, setDialog] = useState<"meals" | "rooms" | "pass" | "departure" | null>(null);
  const selected = data.sessions.find((s) => s.id === selectedId);
  const date = data.context?.referenceBusinessDate || "";
  const periodId = data.context?.businessPeriodId || "";
  const sessions = data.sessions.filter((s) => `${s.customerName} ${s.gameId}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (scope === "all" || (s.entryStatus === "departed" || s.status !== "active") === (scope === "departed")));
  const currentEntry = selected?.businessPeriodId === periodId;
  const canOrder = currentEntry && selected?.status === "active" && selected.entryStatus === "open";
  const saved = async () => { setDialog(null); await onChanged(); };
  return <AdminPanel className="serviceGuestPanel" title="顧客現場處理" description="搜尋本期顧客，處理代點、點餐碼、離店與同單收款。">
    <div className="serviceGuestFilters"><label>顧客搜尋<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="顧客名稱或遊戲 ID" /></label><label>入場狀態<select value={scope} onChange={(e) => setScope(e.target.value)}><option value="all">全部</option><option value="open">在場／可點餐</option><option value="departed">已離店／唯讀</option></select></label><label>選擇顧客<select disabled={disabled || Boolean(dialog)} value={selectedId} onChange={(e) => onSelect(e.target.value)}><option value="">請選擇顧客（{sessions.length} 位）</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.customerName} · {s.gameId}</option>)}</select></label></div>
    {selected ? <div key={selected.id}>
      <h3>{selected.customerName} · {selected.gameId}</h3>
      {!currentEntry && <p>此為跨期履約顧客；原入場紀錄不提供本期代點、重發碼或重開點餐。</p>}
      <AdmissionSummary sessionId={selected.id} refreshKey={data.refreshedAt} />
      <div className="adminPageActions"><AdminButton disabled={disabled || !canOrder} onClick={() => setDialog("meals")}>代客點餐</AdminButton><AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => setDialog("rooms")}>代訂包廂</AdminButton><AdminButton variant="secondary" disabled={disabled || !currentEntry} onClick={() => setDialog("pass")}>重發點餐碼</AdminButton><AdminButton variant="ghost" disabled={disabled || !currentEntry} onClick={() => setDialog("departure")}>{selected.status === "active" ? "顧客離店" : "重開點餐"}</AdminButton></div>
      {data.orders.filter((o) => o.sessionId === selected.id).map((order) => <details className="serviceGuestOrder" key={order.id}><summary>{order.orderNumber} · {order.totalAmount.toLocaleString("zh-TW")} G</summary><ServiceOrderDetail order={order} units={units[order.id] || []} disabled={disabled} periodId={periodId} businessDate={date} staffId={user?.staffMemberId || ""} onChanged={onChanged} onBusy={onBusy} /></details>)}
      {!data.orders.some((o) => o.sessionId === selected.id) && <p>此顧客尚未點餐；入場費狀態請以上方入場帳為準。</p>}
      <AdminDialog open={Boolean(dialog)} title={dialog === "pass" ? "重發點餐碼" : dialog === "departure" ? "離店／重開點餐" : "代客訂購"} description={selected.customerName} onClose={() => { if (!disabled && (!(dialog === "meals" || dialog === "rooms") || window.confirm("確定關閉代客訂購？尚未送出的內容會放棄。"))) setDialog(null); }} actions={null}>
        {dialog === "pass" && <WorkbenchPassAction session={selected} onChanged={onChanged} onBusy={onBusy} />}
        {dialog === "departure" && <WorkbenchDepartureAction session={selected} onSaved={saved} onBusy={onBusy} />}
        {(dialog === "meals" || dialog === "rooms") && <WorkbenchOrderComposer sessionId={selected.id} businessDate={date} mode={dialog} staffId={user?.staffMemberId || ""} onSaved={saved} onBusy={onBusy} />}
      </AdminDialog>
    </div> : <p>選擇顧客後顯示入場、訂單與收款資訊。</p>}
  </AdminPanel>;
}
