"use client";

import { useEffect, useRef, useState } from "react";
import { guestbookRequest, guestbookUrl } from "@/features/guestbook/api/client";
import { GuestbookComposer } from "@/features/guestbook/components/GuestbookComposer";
import { GuestbookMessageText, guestbookDateLabel } from "@/features/guestbook/components/GuestbookMessageText";
import type { GuestbookMessage, GuestbookReplies } from "@/features/guestbook/types";
import { parseGuestbookReplies } from "@/features/guestbook/validation";

type GuestbookThreadProps = {
  message: GuestbookMessage;
  busy: boolean;
  cooldown: number;
  name: string;
  submit: (name: string, content: string, website: string, id?: string) => Promise<boolean>;
};

export function GuestbookThread({ message, busy, cooldown, name, submit }: GuestbookThreadProps) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replies, setReplies] = useState<GuestbookReplies | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const load = async (page = 1, cursor?: string | null) => {
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
      setReplies((previous) => ({
        ...result,
        items: page === 1
          ? result.items
          : [
              ...(previous?.items ?? []),
              ...result.items.filter((item) => !previous?.items.some((old) => old.id === item.id)),
            ],
      }));
    } catch (cause) {
      if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : "無法載入回覆。");
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  };

  const toggleReplies = () => {
    setExpanded((current) => !current);
    if (!expanded) void load();
  };

  return (
    <article className={`guest-note${message.isPinned ? " pinned" : ""}`}>
      <header>
        <span>{message.isPinned ? "PINNED NOTE" : "TRAVELER NOTE"}</span>
        <time dateTime={message.createdAt}>{guestbookDateLabel(message.createdAt)}</time>
      </header>
      <h2>
        {message.displayName}{" "}
        {message.authorType !== "customer" ? <small className="guest-official">店家發言</small> : null}
      </h2>
      <GuestbookMessageText message={message} />
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
      {expanded ? (
        <div className="guest-replies" id={`replies-${message.id}`}>
          {replies?.items.map((reply) => (
            <blockquote key={reply.id}>
              <span>
                {reply.displayName}{" "}
                {reply.authorType !== "customer" ? <b className="guest-official">店家回覆</b> : null}
              </span>
              <GuestbookMessageText message={reply} />
              <time>{guestbookDateLabel(reply.createdAt)}</time>
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
      {message.allowReplies ? (
        <button className="guest-reply-toggle" aria-expanded={replying} onClick={() => setReplying((value) => !value)}>
          {replying ? "取消回覆" : "留下回覆"} <i>↗</i>
        </button>
      ) : <p className="guest-closed">此留言串已關閉回覆</p>}
      {replying && message.allowReplies ? (
        <GuestbookComposer
          reply
          initialName={name}
          busy={busy}
          cooldown={cooldown}
          onSubmit={async (displayName, content, website) => {
            const success = await submit(displayName, content, website, message.id);
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
