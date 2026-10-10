"use client";
import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { AdminDialog, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { customerApi } from "@/features/admin/customers/api";
import { DELIVERY_STATUS_LABELS, formatCustomerTime } from "@/features/admin/customers/presentation";
import { useCustomerMutation } from "@/features/admin/customers/useCustomerMutation";
import type { ArtDelivery, DeliveryIssued } from "@/features/admin/customers/types";
import { DeliveryEditor } from "./DeliveryEditor";
import { DeliveryCredentials } from "./DeliveryCredentials";
import { DeliveryHistoryPanel } from "./DeliveryHistoryPanel";
import { nextAction } from "./presentation";
import { workspaceApi, type DeliveryStaff } from "./workspaceApi";

type Props = { initial: ArtDelivery; staff: DeliveryStaff[]; canManage: boolean; initialCode: string | null;
  onChanged: (value: ArtDelivery) => void; onIssued: (value: DeliveryIssued) => void; onDirty: (value: boolean) => void; onBusy: (value: boolean) => void; onClose: () => void };
export function DeliveryDetail({ initial, staff, canManage, initialCode, onChanged, onIssued, onDirty, onBusy, onClose }: Props) {
  const [delivery, setDelivery] = useState(initial);
  const [tab, setTab] = useState(initialCode ? 1 : 0);
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [assignment, setAssignment] = useState(initial.assignedStaffId || "");
  const [dialog, setDialog] = useState<"publish" | "notify" | "preview" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [historyRevision, setHistoryRevision] = useState(0);
  const { busy, error, perform } = useCustomerMutation();
  const locked = busy || editorBusy || codeBusy;
  const unsaved = dirty || assignment !== (delivery.assignedStaffId || "");
  const id = useId();
  useEffect(() => { onDirty(unsaved); }, [unsaved, onDirty]);
  useEffect(() => { onBusy(locked); }, [locked, onBusy]);
  function changed(value: ArtDelivery, resetEditor = false) {
    setDelivery(value); setAssignment(value.assignedStaffId || ""); setHistoryRevision((count) => count + 1);
    if (resetEditor) { setEditorKey((key) => key + 1); setDirty(false); }
    onChanged(value);
  }
  function issued(value: DeliveryIssued) { changed(value.delivery, true); onIssued(value); }
  function confirmWorkflow() {
    if (dialog === "publish") void perform((signal) => customerApi.updateDelivery(delivery.id, { version: delivery.version, title: delivery.title, description: delivery.description, dueDate: delivery.dueDate?.slice(0, 10) || null, status: "ready" }, signal), (value) => { changed(value, true); setDialog(null); setFeedback("已開放領取，接著將領取資料傳給顧客。"); });
    if (dialog === "notify") void perform((signal) => workspaceApi.notify(delivery.id, delivery.version, signal), (value) => { changed(value, true); setDialog(null); setFeedback("已記錄通知，等待顧客確認收到。"); });
  }
  const stage = delivery.status === "delivered" ? 3 : delivery.status === "ready" ? 2 : 1;
  return <AdminPanel title={delivery.title} description={`${delivery.customerName} · ID ${delivery.gameId}`} actions={<button type="button" className="adminButton adminButton-ghost" disabled={locked} onClick={onClose}>關閉詳情</button>}>
    <div className="adminDeliveryDetailMeta"><span className={`adminDeliveryStatus is-${delivery.status}`}>{DELIVERY_STATUS_LABELS[delivery.status]}</span><span>預計交付 {delivery.dueDate?.slice(0, 10) || "未設定"}</span><span>{delivery.assets.length} 個附件</span></div>
    {delivery.status === "cancelled" ? <p className="adminCustomerHint">此委託已取消。</p> : <ol className="adminDeliveryProgress" aria-label="交付進度">{["建立委託", "製作作品", "開放領取", "確認收到"].map((label, index) => <li key={label} className={index < stage ? "isDone" : index === stage ? "isCurrent" : ""} aria-current={index === stage ? "step" : undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>}
    <section className="adminDeliveryNext" aria-label="交付下一步"><div><small>下一步</small><strong>{nextAction(delivery)}</strong>{delivery.notifiedAt ? <p>通知紀錄：{formatCustomerTime(delivery.notifiedAt)}</p> : null}</div><div className="adminCustomerActions">
      {["pending", "in_progress"].includes(delivery.status) ? <button type="button" className="adminButton adminButton-primary" disabled={locked || unsaved} onClick={() => delivery.assets.length ? setDialog("publish") : setTab(0)}>{delivery.assets.length ? "核對並開放領取" : "加入作品附件"}</button> : null}
      {delivery.status === "ready" ? <><button type="button" className="adminButton adminButton-primary" disabled={locked} onClick={() => setTab(1)}>查看領取資料</button>{!delivery.notifiedAt ? <button type="button" className="adminButton adminButton-secondary" disabled={locked || unsaved || !delivery.workspaceAvailable} onClick={() => setDialog("notify")}>記錄已通知</button> : null}</> : null}
      <button type="button" className="adminButton adminButton-ghost" disabled={locked} onClick={() => setDialog("preview")}>顧客畫面預覽</button>
    </div>{unsaved ? <p className="adminCustomerHint">有未儲存內容，請先儲存再執行下一步。</p> : null}</section>
    {error ? <p className="adminCustomerFeedback isError" role="alert">{error}</p> : null}{feedback ? <p className="adminCustomerFeedback" role="status">{feedback}</p> : null}
    <div className="adminDeliveryDetailTabs" role="tablist" aria-label="委託詳情">{["作品內容", "領取資料", "處理紀錄"].map((label, index) => <button key={label} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} disabled={locked} onClick={() => setTab(index)} onKeyDown={(event) => { const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null; if (next !== null) { event.preventDefault(); setTab(next); document.getElementById(`${id}-tab-${next}`)?.focus(); } }}>{label}</button>)}</div>
    <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={tab !== 0}>
      <section className="adminDeliveryAssignment"><AdminField label="委託負責人"><select value={assignment} disabled={locked || !delivery.workspaceAvailable} onChange={(event) => setAssignment(event.target.value)}><option value="">尚未指派</option>{delivery.assignedStaffId && !staff.some((member) => member.id === delivery.assignedStaffId) ? <option value={delivery.assignedStaffId}>{delivery.assignedStaffName || "原負責人（已停用）"}</option> : null}{staff.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></AdminField><button type="button" className="adminButton adminButton-secondary" disabled={locked || dirty || !delivery.workspaceAvailable || assignment === (delivery.assignedStaffId || "")} onClick={() => void perform((signal) => workspaceApi.assign(delivery.id, delivery.version, assignment || null, signal), (value) => { changed(value, true); setFeedback("負責人已更新。"); })}>儲存負責人</button></section>
      <p className="adminCustomerHint">「我的委託」依負責人歸屬篩選；仍可在全部交付查看店內作品。</p>
      <DeliveryEditor key={editorKey} initial={delivery} embedded locked={busy || codeBusy} canManage={canManage} onChanged={(value) => changed(value)} onIssued={issued} onClose={onClose} onDirty={setDirty} onBusy={setEditorBusy} />
    </div>
    <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={tab !== 1}>{tab === 1 ? <DeliveryCredentials delivery={delivery} initialCode={initialCode} canManage={canManage} locked={locked || unsaved} onIssued={issued} onBusy={setCodeBusy} /> : null}</div>
    <div role="tabpanel" id={`${id}-panel-2`} aria-labelledby={`${id}-tab-2`} hidden={tab !== 2}>{tab === 2 ? <DeliveryHistoryPanel id={delivery.id} revision={historyRevision} available={delivery.workspaceAvailable} /> : null}</div>
    <AdminDialog open={dialog !== null} title={dialog === "preview" ? "顧客畫面預覽" : dialog === "notify" ? "記錄已通知顧客" : "開放作品領取"} description={dialog === "preview" ? "預覽目前已儲存內容。製作中的附件只在此後台預覽顯示。" : dialog === "notify" ? "請確認已實際將領取資料傳送給顧客。複製文字本身不代表已通知。" : "開放後顧客可讀取目前所有附件。請先核對作品與雲端連結權限。"} onClose={() => { if (!busy) setDialog(null); }} actions={null}>
      {dialog === "preview" ? <div className="adminDeliveryCustomerPreview"><span className="adminDeliveryStatus">{DELIVERY_STATUS_LABELS[delivery.status]}</span><h3>{delivery.title}</h3><p>{delivery.description || "尚無作品說明"}</p>{!["ready", "delivered"].includes(delivery.status) ? <p>顧客目前只能看到進度，還無法讀取附件。</p> : null}<div className="adminDeliveryAssetGrid">{delivery.assets.map((asset) => <article key={asset.id}>{asset.kind === "image" ? <Image unoptimized width={640} height={480} src={`/api/admin/art-deliveries/${encodeURIComponent(delivery.id)}/assets/${encodeURIComponent(asset.id)}`} alt={asset.label} /> : <strong>雲端連結 · {asset.label}</strong>}<span>{asset.label}</span></article>)}</div></div> : <>{error ? <p role="alert">{error}</p> : null}<button type="button" className="adminButton adminButton-primary" disabled={busy} onClick={confirmWorkflow}>{busy ? "處理中…" : dialog === "notify" ? "已實際傳送，記錄通知" : "已核對附件，開放領取"}</button></>}
    </AdminDialog>
  </AdminPanel>;
}
