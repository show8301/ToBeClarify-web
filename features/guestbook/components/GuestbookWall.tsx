"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GuestbookError, guestbookRequest, guestbookUrl } from "@/features/guestbook/api/client";
import { GuestbookComposer } from "@/features/guestbook/components/GuestbookComposer";
import { GuestbookThread } from "@/features/guestbook/components/GuestbookThread";
import type { GuestbookList, GuestbookMessage, GuestbookSubmission } from "@/features/guestbook/types";
import { parseGuestbookList, parseGuestbookMessage } from "@/features/guestbook/validation";

const COOLDOWN_MILLISECONDS = 180_000;

export default function GuestbookWall() {
  const [list, setList] = useState<GuestbookList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [activeFeed, setActiveFeed] = useState<"recent" | "pinned">("recent");
  const deadline = useRef(0);
  const submitting = useRef(false);
  const listController = useRef<AbortController | null>(null);
  const submitController = useRef<AbortController | null>(null);
  const listRequestId = useRef(0);

  const load = useCallback(async (page = 1, append = false, cursor?: string | null) => {
    listController.current?.abort();
    const controller = new AbortController();
    const requestId = ++listRequestId.current;
    listController.current = controller;
    setLoading(true);
    try {
      const data = await guestbookRequest(
        guestbookUrl("", { page, cursor }),
        parseGuestbookList,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || requestId !== listRequestId.current) return;
      setError("");
      setList((previous) => ({
        ...data,
        items: append
          ? [
              ...(previous?.items.filter((item) => !data.pinnedItems.some((pin) => pin.id === item.id)) ?? []),
              ...data.items.filter((item) => !previous?.items.some((old) => old.id === item.id)),
            ]
          : data.items,
      }));
    } catch (cause) {
      if (!controller.signal.aborted && requestId === listRequestId.current) {
        setError(cause instanceof Error ? cause.message : "無法載入留言。");
      }
    } finally {
      if (!controller.signal.aborted && requestId === listRequestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++listRequestId.current;
    listController.current = controller;
    guestbookRequest(guestbookUrl("", { page: 1 }), parseGuestbookList, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || requestId !== listRequestId.current) return;
        setList(data);
        setError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted && requestId === listRequestId.current) {
          setError(cause instanceof Error ? cause.message : "無法載入留言。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === listRequestId.current) setLoading(false);
      });
    const timer = window.setInterval(() => {
      setCooldown(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 1000);
    return () => {
      clearInterval(timer);
      listController.current?.abort();
      submitController.current?.abort();
    };
  }, [load]);

  const submit = async (input: GuestbookSubmission, id?: string) => {
    if (submitting.current || Date.now() < deadline.current) return false;
    submitting.current = true;
    setBusy(true);
    setStatus("");
    const controller = new AbortController();
    submitController.current = controller;
    try {
      await guestbookRequest(
        guestbookUrl(id ? `/${encodeURIComponent(id)}/replies` : ""),
        parseGuestbookMessage,
        {
          method: "POST",
          body: JSON.stringify(input),
          signal: controller.signal,
        },
      );
      deadline.current = Date.now() + COOLDOWN_MILLISECONDS;
      setCooldown(COOLDOWN_MILLISECONDS / 1000);
      setName(input.displayName);
      setStatus(id ? "回覆已留下。" : "留言已送出，謝謝你為今晚留下紀錄。");
      if (id) {
        const increaseReplyCount = (item: GuestbookMessage) => item.id === id
          ? { ...item, replyCount: item.replyCount + 1 }
          : item;
        setList((current) => current && ({
          ...current,
          items: current.items.map(increaseReplyCount),
          pinnedItems: current.pinnedItems.map(increaseReplyCount),
        }));
      } else {
        await load();
      }
      return true;
    } catch (cause) {
      if (controller.signal.aborted) return false;
      if (cause instanceof GuestbookError && cause.code === "RATE_LIMITED") {
        const seconds = cause.retryAfter || COOLDOWN_MILLISECONDS / 1000;
        deadline.current = Date.now() + seconds * 1000;
        setCooldown(seconds);
      }
      setStatus(cause instanceof Error ? cause.message : "留言送出失敗。");
      return false;
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const renderThread = (message: GuestbookMessage) => (
    <GuestbookThread
      key={message.id + "-" + message.likeCount + "-" + message.viewerLiked}
      message={message}
      busy={busy}
      cooldown={cooldown}
      name={name}
      submit={submit}
    />
  );

  return (
    <div className="guestbook-page">
      <section className="guestbook-hero">
        <span>WORDS LEFT BETWEEN WAKING AND DREAM</span>
        <h1>AFTER<br /><i>GLOW</i></h1>
        <p>寫下今晚的片段、給店員的一句話，或下一次想實現的夢。請不要留下現實世界的個人資料。</p>
      </section>
      <section className="guestbook-layout">
        <aside className="guest-composer">
          <span>LEAVE A NOTE · 留言</span>
          <h2>讓這個夜晚<br />多留一會。</h2>
          <GuestbookComposer initialName="" busy={busy} cooldown={cooldown} onSubmit={submit} />
          <p>※每次留言或回覆之間需間隔 3 分鐘。</p>
          <p role="status" aria-live="polite">{status}</p>
        </aside>
        <div className="guestbook-feed">
          {error ? <p role="alert">{error} <button className="guest-reply-toggle" onClick={() => void load()}>重新載入</button></p> : null}
          {loading ? <p role="status">正在載入留言…</p> : null}
          <nav className="guest-feed-tabs" aria-label="留言分類">
            <button type="button" aria-pressed={activeFeed === "recent"} onClick={() => setActiveFeed("recent")}>最新</button>
            <button type="button" aria-pressed={activeFeed === "pinned"} disabled={!list?.pinnedItems.length} onClick={() => setActiveFeed("pinned")}>置頂</button>
          </nav>
          {list?.pinnedItems.length ? (
            <section className={"guest-pinned" + (activeFeed === "pinned" ? " is-active" : "")}>
              <header><span>PINNED NOTES</span><b>置頂留言</b></header>
              {list.pinnedItems.map(renderThread)}
            </section>
          ) : null}
          <section className={"guest-notes" + (activeFeed === "recent" ? " is-active" : "")}>
            <header><span>RECENT AFTERGLOW</span></header>
            {list?.items.map(renderThread)}
            {list && !list.items.length && !list.pinnedItems.length ? <p className="guest-empty">還沒有留言，留下今晚的第一段回憶吧。</p> : null}
          </section>
          {list?.nextCursor ? (
            <button className="guest-load-more" disabled={loading || busy} onClick={() => void load(list.page + 1, true, list.nextCursor)}>
              載入更多留言 ＋
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
