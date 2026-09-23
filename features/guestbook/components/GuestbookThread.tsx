"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { guestbookRequest, guestbookUrl } from "@/features/guestbook/api/client";
import { GuestbookComposer } from "@/features/guestbook/components/GuestbookComposer";
import { GuestbookMessageText, guestbookDateLabel } from "@/features/guestbook/components/GuestbookMessageText";
import { GuestbookEngagementActions } from "@/features/guestbook/components/GuestbookEngagementActions";
import type { GuestbookMessage, GuestbookReplies, GuestbookSubmission } from "@/features/guestbook/types";
import { parseGuestbookMessage, parseGuestbookReplies } from "@/features/guestbook/validation";

type GuestbookThreadProps = {
  message: GuestbookMessage;
  busy: boolean;
  cooldown: number;
  name: string;
  submit: (input: GuestbookSubmission, id?: string) => Promise<boolean>;
  initialExpanded?: boolean;
  targetReplyId?: string | null;
  initialReplies?: GuestbookReplies | null;
};

export function GuestbookThread({ message, busy, cooldown, name, submit, initialExpanded = false, targetReplyId = null, initialReplies = null }: GuestbookThreadProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [replying, setReplying] = useState(false);
  const [replies, setReplies] = useState<GuestbookReplies | null>(initialReplies);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const load = useCallback(async (page = 1, cursor?: string | null) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const result = await guestbookRequest(
        guestbookUrl(`/${encodeURIComponent(message.id)}/replies`, { page, cursor }),
        parseGuestbookReplies,
        { signal: current.signal },
      );
      if (current.signal.aborted) return;
      let items = result.items;
      if (page === 1 && targetReplyId && !items.some((item) => item.id === targetReplyId)) {
        try {
          const target = await guestbookRequest(
            guestbookUrl(`/${encodeURIComponent(message.id)}/replies/${encodeURIComponent(targetReplyId)}`),
            parseGuestbookMessage,
            { signal: current.signal },
          );
          if (!current.signal.aborted) {
            items = [...items, target].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
          }
        } catch {
          if (!current.signal.aborted) setError("此回覆目前無法顯示，可能已被隱藏。");
        }
      }
      setReplies((previous) => ({
        ...result,
        items: page === 1
          ? items
          : [
              ...(previous?.items ?? []),
              ...items.filter((item) => !previous?.items.some((old) => old.id === item.id)),
            ],
      }));
    } catch (cause) {
      if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : "無法載入回覆。");
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [message.id, targetReplyId]);

  useEffect(() => {
    if (!expanded || !targetReplyId || !replies?.items.some((item) => item.id === targetReplyId)) return;
    document.getElementById(`guest-reply-${targetReplyId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [expanded, replies, targetReplyId]);

  const toggleReplies = () => {
    setExpanded((current) => !current);
    if (!expanded) void load();
  };

  return (
    <article className={`guest-note${message.isPinned ? " pinned" : ""}`}>
      <header>
        <h2>
          {message.displayName}{" "}
          {message.authorType !== "customer" ? <small className="guest-official">店家發言</small> : null}
        </h2>
        <time dateTime={message.createdAt}>{guestbookDateLabel(message.createdAt)}</time>
        {message.isPinned ? <span className="guest-pin-label">置頂留言</span> : null}
      </header>
      <GuestbookMessageText message={message} />
      <GuestbookEngagementActions message={message} replying={replying} onReply={() => setReplying((value) => !value)} />
      {message.replyCount > 0 || replies ? (
        <div className="guest-note-actions">
          {message.replyCount > 0 || replies ? (
            <button
              className="guest-reply-toggle"
              aria-expanded={expanded}
              aria-controls={`replies-${message.id}`}
              onClick={toggleReplies}
            >
              {expanded ? "收起回覆" : `查看 ${message.replyCount} 則回覆`} <i>{expanded ? "−" : "+"}</i>
            </button>
          ) : null}
        </div>
      ) : null}
      {expanded ? (
        <div className="guest-replies" id={`replies-${message.id}`}>
          {replies?.items.map((reply) => (
            <blockquote key={reply.id} id={`guest-reply-${reply.id}`}>
              <div className="guest-reply-meta">
                <span>
                  {reply.displayName}{" "}
                  {reply.authorType !== "customer" ? <b className="guest-official">店家回覆</b> : null}
                </span>
                <time dateTime={reply.createdAt}>{guestbookDateLabel(reply.createdAt)}</time>
              </div>
              <GuestbookMessageText message={reply} />
              <GuestbookEngagementActions key={reply.id + "-" + reply.likeCount + "-" + reply.viewerLiked} message={reply} />
            </blockquote>
          ))}
          {loading ? <p role="status">正在載入回覆…</p> : null}
          {error ? <p role="alert">{error} <button onClick={() => void load()}>重試</button></p> : null}
          {replies?.nextCursor ? (
            <button
              className="guest-reply-toggle"
              disabled={loading}
              onClick={() => void load(replies.page + 1, replies.nextCursor)}
            >
              載入更多回覆
            </button>
          ) : null}
        </div>
      ) : null}
      {!message.allowReplies ? <p className="guest-closed">此留言串已關閉回覆</p> : null}
      {replying && message.allowReplies ? (
        <GuestbookComposer
          reply
          initialName={name}
          busy={busy}
          cooldown={cooldown}
          onSubmit={async (input) => {
            const success = await submit(input, message.id);
            if (success) {
              setReplying(false);
              setExpanded(true);
              await load();
            }
            return success;
          }}
        />
      ) : null}
    </article>
  );
}
