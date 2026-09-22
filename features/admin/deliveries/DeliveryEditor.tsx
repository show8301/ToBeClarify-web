"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AdminDialog, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { customerApi } from "@/features/admin/customers/api";
import { DELIVERY_STATUS_LABELS, formatCustomerTime, queryPath } from "@/features/admin/customers/presentation";
import { useCustomerMutation } from "@/features/admin/customers/useCustomerMutation";
import type { ArtDelivery, DeliveryAsset, DeliveryIssued } from "@/features/admin/customers/types";

type Props = {
  initial: ArtDelivery;
  canManage: boolean;
  onChanged: (value: ArtDelivery) => void;
  onIssued: (value: DeliveryIssued) => void;
  onClose: () => void;
};
type Confirmation = { kind: "code" } | { kind: "remove"; asset: DeliveryAsset } | null;

export function DeliveryEditor({ initial, canManage, onChanged, onIssued, onClose }: Props) {
  const [delivery, setDelivery] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description || "");
  const [dueDate, setDueDate] = useState(initial.dueDate?.slice(0, 10) || "");
  const [status, setStatus] = useState(initial.status);
  const [feedback, setFeedback] = useState("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const { busy, error, perform } = useCustomerMutation();
  const publishWithoutAsset = ["ready", "delivered"].includes(status) && delivery.assets.length === 0;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function update(value: ArtDelivery, message: string) {
    setDelivery(value);
    setStatus(value.status);
    setFeedback(message);
    onChanged(value);
  }
  function chooseFile(value: File | null) {
    setFileError("");
    setFile(null);
    setPreview("");
    if (!value) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(value.type) || value.size > 10 * 1024 * 1024) {
      setFileError("請選擇 10 MiB 以內的 JPEG、PNG 或 WebP 靜態圖片。");
      return;
    }
    setFile(value);
    setPreview(URL.createObjectURL(value));
    if (!label.trim()) setLabel(value.name.slice(0, 160));
  }
  function confirm() {
    if (!confirmation) return;
    if (confirmation.kind === "code") {
      void perform((signal) => customerApi.reissueCode(delivery.id, signal), (value) => {
        update(value.delivery, "已重發單筆領取碼，舊碼已失效。");
        setConfirmation(null);
        onIssued(value);
      });
    } else {
      void perform((signal) => customerApi.removeAsset(delivery.id, confirmation.asset.id, signal), (value) => {
        update(value, "附件已移除，請確認剩餘內容後重新設為可領取。");
        setConfirmation(null);
      });
    }
  }

  return <AdminPanel title={`交付管理 · ${delivery.title}`} description={`${delivery.customerName} · ${delivery.businessDate.slice(0, 10)} · ${delivery.orderNumber || "入場紀錄"}`} actions={<button type="button" className="adminButton adminButton-ghost" disabled={busy} onClick={onClose}>收合</button>}>
    <div className="adminCustomerActions">
      <Link className="adminButton adminButton-secondary" href={queryPath("/admin/order-list", { date: delivery.businessDate.slice(0, 10), session: delivery.sessionId, order: delivery.orderId })}>核對歷史訂單</Link>
      {canManage ? <button type="button" className="adminButton adminButton-secondary" disabled={busy} onClick={() => setConfirmation({ kind: "code" })}>重發單筆領取碼</button> : <span className="adminCustomerHint">重發領取碼需由店經理處理。</span>}
    </div>
    {error ? <p className="adminCustomerFeedback isError" role="alert">{error} 若資料已被其他人更新，請收合後重新整理清單再開啟。</p> : null}
    {feedback ? <p className="adminCustomerFeedback" role="status">{feedback}</p> : null}
    <form className="adminCustomerForm" onSubmit={(event) => {
      event.preventDefault();
      void perform((signal) => customerApi.updateDelivery(delivery.id, { version: delivery.version, title: title.trim(), description: description.trim() || null, status, dueDate: dueDate || null }, signal), (value) => {
        update(value, `已儲存，交付狀態：${DELIVERY_STATUS_LABELS[value.status] || value.status}。`);
        setTitle(value.title);
        setDescription(value.description || "");
        setDueDate(value.dueDate?.slice(0, 10) || "");
      });
    }}>
      <AdminField label="作品名稱" required><input required maxLength={160} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} /></AdminField>
      <AdminField label="顧客可見說明"><textarea rows={3} maxLength={2000} value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} /></AdminField>
      <div className="adminCustomerFilters">
        <AdminField label="預計交付日"><input type="date" value={dueDate} disabled={busy} onChange={(event) => setDueDate(event.target.value)} /></AdminField>
        <AdminField label="交付狀態"><select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value)}>{Object.entries(DELIVERY_STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></AdminField>
      </div>
      <p className="adminCustomerHint">上傳作品後，儲存為「可領取」才會開放附件；顧客確認收到後會標記「已領取」。新增或移除附件會回到製作中，需要重新開放。</p>
      {publishWithoutAsset ? <p role="status">請先上傳圖片或加入雲端連結，才能設為可領取或已領取。</p> : null}
      {delivery.deliveredAt ? <p>顧客領取紀錄：{formatCustomerTime(delivery.deliveredAt)}</p> : null}
      <button className="adminButton adminButton-primary" type="submit" disabled={busy || !title.trim() || publishWithoutAsset}>{busy ? "處理中…" : "儲存作品與交付狀態"}</button>
    </form>

    <section className="adminDeliveryAssets" aria-label="交付附件">
      <h3>交付附件 · {delivery.assets.length} 個</h3>
      <div className="adminDeliveryAssetGrid">{delivery.assets.map((asset) => <article key={asset.id}>
        {asset.kind === "image" ? <Image unoptimized width={640} height={480} src={`/api/admin/art-deliveries/${encodeURIComponent(delivery.id)}/assets/${encodeURIComponent(asset.id)}`} alt={asset.label} loading="lazy" /> : <span className="adminDeliveryLinkMark" aria-hidden="true">↗</span>}
        <strong>{asset.label}</strong>
        {asset.kind === "image" ? <small>{(asset.byteSize / (1024 * 1024)).toFixed(2)} MiB · 私密圖片</small> : <small>外部 HTTPS 連結</small>}
        <div className="adminCustomerActions">
          {assetHref(delivery.id, asset) ? <a className="adminButton adminButton-secondary" href={assetHref(delivery.id, asset)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">檢視附件</a> : <span>附件網址無法使用</span>}
          <button type="button" className="adminButton adminButton-ghost" disabled={busy} onClick={() => setConfirmation({ kind: "remove", asset })}>移除附件</button>
        </div>
      </article>)}</div>
      {!delivery.assets.length ? <p className="adminEmptyText">尚未加入作品圖片或雲端連結。</p> : null}
      <div className="adminDeliveryUpload">
        <AdminField label="附件名稱"><input maxLength={160} value={label} disabled={busy} onChange={(event) => setLabel(event.target.value)} placeholder="例如：作品原圖／列印用檔案" /></AdminField>
        <form className="adminCustomerForm" onSubmit={(event) => {
          event.preventDefault();
          if (!file) return;
          void perform((signal) => customerApi.upload(delivery.id, label.trim(), file, signal), (value) => {
            update(value, "圖片已存入私密作品空間，請確認後設為可領取。");
            setFile(null);
            setPreview("");
          });
        }}>
          <AdminField label="私密作品圖片" hint="JPEG／PNG／WebP，10 MiB、2400 萬畫素以內的靜態圖片。伺服器以無損 PNG 保留畫素與透明度，清除圖片中繼資料。"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { chooseFile(event.target.files?.[0] || null); event.target.value = ""; }} /></AdminField>
          {preview ? <Image unoptimized width={640} height={480} className="adminDeliveryUploadPreview" src={preview} alt="待上傳作品預覽" /> : null}
          {fileError ? <p role="alert">{fileError}</p> : null}
          <button type="submit" className="adminButton adminButton-secondary" disabled={busy || !file || !label.trim()}>上傳至私密作品空間</button>
        </form>
        <form className="adminCustomerForm" onSubmit={(event) => {
          event.preventDefault();
          void perform((signal) => customerApi.addLink(delivery.id, label.trim(), url.trim(), signal), (value) => {
            update(value, "雲端連結已加入，請確認連結權限後設為可領取。");
            setUrl("");
          });
        }}>
          <AdminField label="雲端檔案連結" hint="僅接受 HTTPS。請確認顧客可開啟，且此連結沒有包含其他顧客的作品。"><input type="url" required pattern="https://.*" maxLength={2048} value={url} disabled={busy} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></AdminField>
          <button type="submit" className="adminButton adminButton-secondary" disabled={busy || !url.trim() || !label.trim()}>加入雲端連結</button>
        </form>
      </div>
    </section>
    <AdminDialog open={confirmation !== null} title={confirmation?.kind === "code" ? "重發單筆領取碼" : "移除作品附件"} description={confirmation?.kind === "code" ? "重發後舊領取碼立即失效。請先核對顧客資料，再將新的領取碼私下交給顧客。" : `將移除「${confirmation?.kind === "remove" ? confirmation.asset.label : ""}」，作品會回到製作中，顧客暫時無法領取附件。`} onClose={() => { if (!busy) setConfirmation(null); }} actions={null}>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" className="adminButton adminButton-primary" disabled={busy} onClick={confirm}>{busy ? "處理中…" : confirmation?.kind === "code" ? "已核對，重發領取碼" : "確認移除附件"}</button>
    </AdminDialog>
  </AdminPanel>;
}

function assetHref(deliveryId: string, asset: DeliveryAsset): string | undefined {
  if (asset.kind === "image") return `/api/admin/art-deliveries/${encodeURIComponent(deliveryId)}/assets/${encodeURIComponent(asset.id)}`;
  if (asset.kind !== "link" || !asset.url) return undefined;
  try {
    const value = new URL(asset.url);
    return value.protocol === "https:" && !value.username && !value.password ? value.href : undefined;
  } catch { return undefined; }
}
