import { useState } from "react";
import { AdminButton, AdminDialog, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { AdminHelp } from "@/features/admin/shared/AdminHelp";
import { AdmissionSummary } from "@/features/admin/orders/AdmissionSummary";
import { WorkbenchOrderComposer } from "./WorkbenchOrderComposer";
import { WorkbenchDepartureAction, WorkbenchPassAction } from "./WorkbenchGuestActions";
import { ServiceGuestPicker } from "./ServiceGuestPicker";
import type { CurrentAdminUser, OperationsData, OperationsOrder } from "./operationsTypes";

export function ServiceGuestPanel({ data, user, selectedId, onSelect, disabled, onBusy, onChanged, onOpenOrder }: {
  data: OperationsData; user?: CurrentAdminUser; selectedId: string;
  onSelect: (id: string) => void; disabled: boolean; onBusy: (busy: boolean) => void; onChanged: () => Promise<void>;
  onOpenOrder: (order: OperationsOrder) => void;
}) {
  const [dialog, setDialog] = useState<"meals" | "rooms" | "pass" | "departure" | null>(null);
  const selected = data.sessions.find((s) => s.id === selectedId);
  const date = data.context?.referenceBusinessDate || "";
  const periodId = data.context?.businessPeriodId || "";
  const currentEntry = selected?.businessPeriodId === periodId;
  const canOrder = currentEntry && selected?.status === "active" && selected.entryStatus === "open";
  const saved = async () => { setDialog(null); await onChanged(); };
  return <AdminPanel className="serviceGuestPanel" title={<span className="adminFieldHeading">顧客現場處理<AdminHelp title="顧客現場處理說明">搜尋本期入場與跨期履約顧客，處理代點、點餐碼、離店與同單收款。在場不代表本期可點餐，服務完成與帳款結清分開追蹤。</AdminHelp></span>}>
    <ServiceGuestPicker sessions={data.sessions} periodId={periodId} selectedId={selectedId} onSelect={onSelect} disabled={disabled || Boolean(dialog)} />
    {selected ? <div key={selected.id}>
      <h3>{selected.customerName} · {selected.gameId}</h3>
      {!currentEntry && <p>此為跨期履約顧客；原入場紀錄不提供本期代點、重發碼或重開點餐。</p>}
      <AdmissionSummary sessionId={selected.id} refreshKey={data.refreshedAt} />
      <div className="adminPageActions"><AdminButton disabled={disabled || !canOrder} onClick={() => setDialog("meals")}>代客點餐</AdminButton><AdminButton variant="secondary" disabled={disabled || !canOrder} onClick={() => setDialog("rooms")}>代訂包廂</AdminButton><AdminButton variant="secondary" disabled={disabled || !currentEntry} onClick={() => setDialog("pass")}>重發點餐碼</AdminButton><AdminButton variant="ghost" disabled={disabled || !currentEntry} onClick={() => setDialog("departure")}>{selected.status === "active" ? "顧客離店" : "重開點餐"}</AdminButton></div>
      {data.orders.filter((o) => o.sessionId === selected.id).map((order) => <article className="serviceGuestOrder serviceGuestOrderLink" key={order.id}><span>{order.orderNumber} · {order.totalAmount.toLocaleString("zh-TW")} G</span><AdminButton disabled={disabled} aria-controls="service-current-order" onClick={() => onOpenOrder(order)}>服務處理／收款</AdminButton></article>)}
      {!data.orders.some((o) => o.sessionId === selected.id) && <p>此顧客尚未點餐；入場費狀態請以上方入場帳為準。</p>}
      <AdminDialog open={Boolean(dialog)} title={dialog === "pass" ? "重發點餐碼" : dialog === "departure" ? "離店／重開點餐" : "代客訂購"} description={selected.customerName} onClose={() => { if (!disabled && (!(dialog === "meals" || dialog === "rooms") || window.confirm("確定關閉代客訂購？尚未送出的內容會放棄。"))) setDialog(null); }} actions={null}>
        {dialog === "pass" && <WorkbenchPassAction session={selected} onChanged={onChanged} onBusy={onBusy} />}
        {dialog === "departure" && <WorkbenchDepartureAction session={selected} onSaved={saved} onBusy={onBusy} />}
        {(dialog === "meals" || dialog === "rooms") && <WorkbenchOrderComposer sessionId={selected.id} businessDate={date} mode={dialog} staffId={user?.staffMemberId || ""} onSaved={saved} onBusy={onBusy} />}
      </AdminDialog>
    </div> : <p>選擇顧客後顯示入場、訂單與收款資訊。</p>}
  </AdminPanel>;
}
