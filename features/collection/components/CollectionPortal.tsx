"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collectionApi } from "../api";
import type { CollectionAccess, CollectionWork } from "../types";
import CollectionAsset from "./CollectionAsset";

const STATUS_LABELS = {
  pending: "等待製作", in_progress: "製作中", ready: "可以領取", delivered: "已領取", cancelled: "已取消",
};

function showDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日期待確認" : date.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
}

function showDueDate(value: string) {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(value);
  return match ? match[1] + "/" + Number(match[2]) + "/" + Number(match[3]) : "日期待確認";
}

function parseClaimCode(value: string) {
  const text = value.trim();
  if (!text.includes("#")) return text;
  const params = new URLSearchParams(text.slice(text.indexOf("#") + 1));
  return params.get("code")?.trim() || "";
}

export default function CollectionPortal() {
  const [mode, setMode] = useState<"code" | "uid">("code");
  const [claimCode, setClaimCode] = useState("");
  const [customerUid, setCustomerUid] = useState("");
  const [works, setWorks] = useState<CollectionWork[] | null>(null);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });
  const [access, setAccess] = useState<CollectionAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ message: "", error: false });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const initialLinkRef = useRef<CollectionAccess | null>(null);

  const lookup = useCallback(async (nextAccess: CollectionAccess, page = 1) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    if (page === 1) { setWorks(null); setAccess(null); }
    setConfirmId(null);
    setNotice({ message: "", error: false });
    try {
      const result = await collectionApi.lookup(nextAccess, controller.signal, page);
      if (controller.signal.aborted) return;
      setAccess(nextAccess);
      setWorks(result.items);
      setPagination({ page: result.page, hasMore: result.hasMore });
      setClaimCode("");
    } catch (error) {
      if (!controller.signal.aborted) setNotice({ message: error instanceof Error ? error.message : "查詢失敗，請稍後再試。", error: true });
    } finally {
      if (!controller.signal.aborted) { initialLinkRef.current = null; setBusy(false); }
    }
  }, []);

  useEffect(() => {
    const readClaimLink = (): CollectionAccess | null => {
      const hash = window.location.hash;
      if (!hash) return null;
      const params = new URLSearchParams(hash.slice(1));
      window.history.replaceState(window.history.state, "", window.location.pathname);
      const code = params.get("code")?.trim();
      const uid = params.get("uid")?.trim();
      if (code && code.length <= 100) return { claimCode: code };
      if (uid && uid.length <= 40) return { customerUid: uid };
      return null;
    };
    const openClaimLink = () => {
      const accessFromLink = readClaimLink();
      if (accessFromLink) void lookup(accessFromLink);
    };
    const initial = readClaimLink() || initialLinkRef.current;
    if (initial) { initialLinkRef.current = initial; void lookup(initial); }
    window.addEventListener("hashchange", openClaimLink);
    return () => {
      window.removeEventListener("hashchange", openClaimLink);
      requestRef.current?.abort();
    };
  }, [lookup]);

  const clear = () => {
    requestRef.current?.abort();
    initialLinkRef.current = null;
    setAccess(null); setWorks(null); setClaimCode(""); setCustomerUid("");
    setConfirmId(null); setBusy(false); setNotice({ message: "", error: false });
  };

  const acknowledge = async (id: string) => {
    if (busy || !access) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setNotice({ message: "", error: false });
    try {
      const updated = await collectionApi.acknowledge(id, access, controller.signal);
      if (controller.signal.aborted) return;
      setWorks((previous) => previous?.map((work) => work.id === id ? updated : work) || null);
      setConfirmId(null);
      setNotice({ message: "已記錄您確認收到作品，謝謝您的委託。", error: false });
    } catch (error) {
      if (!controller.signal.aborted) setNotice({ message: (error instanceof Error ? error.message : "確認失敗。") + " 請重新查詢作品狀態，再決定是否重送確認。", error: true });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <section className="collectionPage" aria-labelledby="collection-title">
      <header className="collectionHero">
        <span className="collectionEyebrow">LUCID DREAM / YOUR COLLECTION</span>
        <h1 id="collection-title">把夢境，帶回身邊。</h1>
        <p>繪圖、簽繪與委託作品，都在這裡等您。貼上店員提供的領取碼或 UID，就能查看進度並收藏完成的作品，無需登入。</p>
      </header>
      <div className="collectionEntry">
        <section className="collectionPanel" aria-labelledby="collection-entry-title">
          <h2 id="collection-entry-title">作品領取</h2>
          <div className="collectionTabs" aria-label="查詢方式">
            <button type="button" aria-pressed={mode === "code"} disabled={busy} onClick={() => setMode("code")}>專屬領取碼</button>
            <button type="button" aria-pressed={mode === "uid"} disabled={busy} onClick={() => setMode("uid")}>顧客 UID</button>
          </div>
          <form className="collectionForm" onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            const code = parseClaimCode(claimCode);
            if (mode === "code" && (!code || code.length > 100)) {
              setNotice({ message: "請輸入店員提供的完整領取碼或領取連結。", error: true }); return;
            }
            const uid = customerUid.trim();
            if (mode === "uid" && (!uid || uid.length > 40)) {
              setNotice({ message: "請輸入有效的顧客 UID。", error: true }); return;
            }
            void lookup(mode === "code" ? { claimCode: code } : { customerUid: uid });
          }}>
            {mode === "code" ? <label>領取碼或完整領取連結
              <input autoComplete="off" spellCheck={false} type="password" value={claimCode} onChange={(event) => setClaimCode(event.target.value)} maxLength={2048} placeholder="貼上您的專屬領取資料" required disabled={busy} />
            </label> : <label>顧客 UID
              <input autoComplete="off" spellCheck={false} value={customerUid} onChange={(event) => setCustomerUid(event.target.value)} maxLength={40} placeholder="店員提供的長期顧客 UID" required disabled={busy} />
            </label>}
            <button type="submit" disabled={busy}>{busy ? "正在查詢…" : "查看我的作品"}</button>
          </form>
          <p className="collectionFineprint">單筆領取碼只開啟對應作品；UID 可查詢已歸戶的作品。當日六位數找回碼僅供點餐協助。</p>
        </section>
        <aside className="collectionHelp">
          <h2>從委託，到收藏</h2>
          <ol>
            <li><strong>保留您的領取資料</strong>委託成立後，店員會提供專屬領取碼或連結。</li>
            <li><strong>隨時查看製作進度</strong>作品完成後，這裡會出現作品圖片下載或雲端連結。</li>
            <li><strong>下載完成，再確認收到</strong>開啟圖片不會自動標記已領取，確認檔案無誤後再按確認。</li>
          </ol>
          <p className="collectionFineprint">UID 是長期顧客識別碼，找回碼只用於當日點單恢復。</p>
        </aside>
      </div>
      {notice.message && <div className={"collectionNotice" + (notice.error ? " isError" : "")} role={notice.error ? "alert" : "status"}>{notice.message}</div>}
      {works && access && <section className="collectionResults" aria-labelledby="collection-results-title">
        <div className="collectionResultsHead">
          <h2 id="collection-results-title">您的委託作品{access.customerUid ? " · 第 " + pagination.page + " 頁" : ""}</h2>
          <div className="collectionActions">
            <button className="collectionSecondary" type="button" disabled={busy} onClick={() => void lookup(access, pagination.page)}>重新查詢進度</button>
            <button className="collectionSecondary" type="button" onClick={clear}>關閉本次查詢</button>
          </div>
        </div>
        {busy && <p role="status" className="collectionFineprint">正在更新作品資料…</p>}
        {works.length === 0 ? <p className="collectionEmpty">目前沒有連結到此 UID 的委託作品。若您已委託製作，請使用該件作品的領取碼，或請店員協助連結。</p> : <div className="collectionWorkList">
          {works.map((work) => <article className="collectionWork" key={work.id}>
            <div className="collectionWorkHead">
              <div><h3>{work.title}</h3><p className="collectionMeta"><span>建立日期 {showDate(work.createdAt)}</span>{work.dueDate && <span>預計完成 {showDueDate(work.dueDate)}</span>}</p></div>
              <span className={"collectionStatus" + (work.status === "ready" ? " isReady" : "")}>{STATUS_LABELS[work.status]}</span>
            </div>
            {work.description && <p className="collectionDescription">{work.description}</p>}
            {(work.status === "pending" || work.status === "in_progress") && <p className="collectionNotice">作品正在準備中。完成後，您可以使用同一組領取資料回來查看。</p>}
            {work.status === "cancelled" && <p className="collectionFineprint">此委託已取消。如有疑問，請聯絡店員確認。</p>}
            {(work.status === "ready" || work.status === "delivered") && <>
              <div className="collectionAssets">{work.assets.map((asset) => <CollectionAsset workId={work.id} asset={asset} access={access} key={asset.id} />)}</div>
              {work.assets.length === 0 && <p className="collectionFineprint">尚無可下載附件，請聯絡店員確認交付方式。</p>}
            </>}
            {work.status === "ready" && (confirmId === work.id ? <div className="collectionConfirm">
              <strong>已下載並確認作品內容了嗎？</strong>
              <p>確認後，店家會記錄您已收到這件作品；下載入口仍會保留。</p>
              <div className="collectionActions"><button type="button" disabled={busy} onClick={() => void acknowledge(work.id)}>{busy ? "正在記錄…" : "確認已收到作品"}</button><button className="collectionSecondary" type="button" disabled={busy} onClick={() => setConfirmId(null)}>稍後確認</button></div>
            </div> : <button type="button" disabled={busy || work.assets.length === 0} onClick={() => setConfirmId(work.id)}>確認已收到作品</button>)}
            {work.status === "delivered" && <p className="collectionFineprint">已確認收到{work.deliveredAt ? " · " + showDate(work.deliveredAt) : ""}。您仍可在這裡下載作品。</p>}
          </article>)}
        </div>}
        {access.customerUid && (pagination.page > 1 || pagination.hasMore) && <nav className="collectionActions" aria-label="作品清單分頁">
          <button className="collectionSecondary" type="button" disabled={busy || pagination.page <= 1} onClick={() => void lookup(access, pagination.page - 1)}>上一頁</button>
          <span className="collectionFineprint">第 {pagination.page} 頁</span>
          <button className="collectionSecondary" type="button" disabled={busy || !pagination.hasMore} onClick={() => void lookup(access, pagination.page + 1)}>下一頁</button>
        </nav>}
      </section>}
    </section>
  );
}
