"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { guestbookRequest, GuestbookError, guestbookUrl } from "@/features/guestbook/api/client";
import { GuestbookComposer } from "@/features/guestbook/components/GuestbookComposer";
import { GuestbookThread } from "@/features/guestbook/components/GuestbookThread";
import { parseGuestbookMessage, parseGuestbookReplies } from "@/features/guestbook/validation";
import type { GuestbookMessage, GuestbookReplies, GuestbookSubmission } from "@/features/guestbook/types";

export function GuestbookSharedThread({ message, targetReplyId, initialReplies }: {
  message: GuestbookMessage;
  targetReplyId: string | null;
  initialReplies: GuestbookReplies | null;
}) {
  const [currentMessage, setCurrentMessage] = useState(message);
  const [currentReplies, setCurrentReplies] = useState(initialReplies);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [deadline, setDeadline] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    guestbookRequest(
      guestbookUrl(`/${encodeURIComponent(message.id)}`),
      parseGuestbookMessage,
      { signal: controller.signal },
    ).then(setCurrentMessage).catch(() => undefined);
    if (targetReplyId) {
      guestbookRequest(
        guestbookUrl(`/${encodeURIComponent(message.id)}/replies`, { page: 1, pageSize: 20 }),
        parseGuestbookReplies,
        { signal: controller.signal },
      ).then(async (result) => {
        if (result.items.some((item) => item.id === targetReplyId)) {
          setCurrentReplies(result);
          return;
        }
        try {
          const target = await guestbookRequest(
            guestbookUrl(`/${encodeURIComponent(message.id)}/replies/${encodeURIComponent(targetReplyId)}`),
            parseGuestbookMessage,
            { signal: controller.signal },
          );
          if (!controller.signal.aborted) {
            setCurrentReplies({
              ...result,
              items: [...result.items, target].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
            });
          }
        } catch {
          if (!controller.signal.aborted) setCurrentReplies(result);
        }
      }).catch(() => undefined);
    }
    return () => controller.abort();
  }, [message.id, targetReplyId]);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCooldown(seconds);
      if (!seconds) setDeadline(0);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const submit = async (input: GuestbookSubmission, id?: string) => {
    if (busy || cooldown > 0) return false;
    setBusy(true);
    setStatus("");
    try {
      await guestbookRequest(
        guestbookUrl(id ? `/${encodeURIComponent(id)}/replies` : ""),
        parseGuestbookMessage,
        { method: "POST", body: JSON.stringify(input) },
      );
      const nextDeadline = Date.now() + 180_000;
      setDeadline(nextDeadline);
      setCooldown(180);
      setName(input.displayName);
      setStatus(id ? "回覆已留下。" : "留言已送出，謝謝你為今晚留下紀錄。");
      return true;
    } catch (cause) {
      if (cause instanceof GuestbookError && cause.code === "RATE_LIMITED") {
        const nextDeadline = Date.now() + (cause.retryAfter || 180) * 1000;
        setDeadline(nextDeadline);
        setCooldown(Math.ceil((nextDeadline - Date.now()) / 1000));
      }
      setStatus(cause instanceof Error ? cause.message : "留言送出失敗。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="guestbook-page">
      <section className="guestbook-hero">
        <span>WORDS LEFT BETWEEN WAKING AND DREAM</span>
        <h1>AFTER<br /><i>GLOW</i></h1>
        <p>分享一段夢境留言，或留下一句回覆。</p>
      </section>
      <p className="guest-shared-back"><Link href="/guestbook">← 返回留言板</Link></p>
      <section className="guestbook-layout guestbook-shared-layout">
        <aside className="guest-composer">
          <h2>留言區</h2>
          <GuestbookComposer initialName={name} busy={busy} cooldown={cooldown} onSubmit={submit} />
          <p>※每次留言或回覆之間需間隔 3 分鐘。</p>
          <p role="status" aria-live="polite">{status}</p>
        </aside>
        <section className="guestbook-feed guest-shared-feed" aria-label="分享的留言串">
          <header><span>{currentMessage.isPinned ? "置頂留言" : "AFTERGLOW NOTE"}</span></header>
          <GuestbookThread
            key={[currentMessage.id, currentMessage.likeCount, currentMessage.viewerLiked, ...(currentReplies?.items.map((item) => item.id + item.likeCount + item.viewerLiked) ?? [])].join(":")}
            message={currentMessage}
            busy={busy}
            cooldown={cooldown}
            name={name}
            submit={submit}
            initialExpanded={Boolean(targetReplyId && currentReplies?.items.some((item) => item.id === targetReplyId))}
            targetReplyId={targetReplyId}
            initialReplies={currentReplies}
          />
        </section>
      </section>
    </main>
  );
}
