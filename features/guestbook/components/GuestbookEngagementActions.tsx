"use client";

import { useState } from "react";
import { guestbookRequest, guestbookUrl } from "@/features/guestbook/api/client";
import { parseGuestbookLikeResult } from "@/features/guestbook/validation";
import type { GuestbookMessage } from "@/features/guestbook/types";

export function guestbookShareUrl(message: GuestbookMessage) {
  const path = `/guestbook/thread/${encodeURIComponent(message.threadId)}`;
  return message.id === message.threadId
    ? path
    : `${path}?reply=${encodeURIComponent(message.id)}`;
}

export function GuestbookEngagementActions({ message, onReply, replying = false }: {
  message: GuestbookMessage;
  onReply?: () => void;
  replying?: boolean;
}) {
  const [likeCount, setLikeCount] = useState(message.likeCount);
  const [liked, setLiked] = useState(message.viewerLiked);
  const [likeBusy, setLikeBusy] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const result = await guestbookRequest(
        guestbookUrl(`/items/${encodeURIComponent(message.id)}/like`),
        parseGuestbookLikeResult,
        { method: "POST", body: JSON.stringify({ liked: !liked }) },
      );
      setLikeCount(result.likeCount);
      setLiked(result.liked);
    } catch (cause) {
      setShareStatus(cause instanceof Error ? cause.message : "無法更新喜歡狀態。");
    } finally {
      setLikeBusy(false);
    }
  };

  const share = async () => {
    const url = new URL(guestbookShareUrl(message), window.location.origin).toString();
    setShareStatus("");
    try {
      if (navigator.share) {
        await navigator.share({ title: "AFTERGLOW 留言板", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("連結已複製。");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus("連結已複製。");
      } catch {
        setShareStatus("無法複製連結，請使用瀏覽器網址分享。");
      }
    }
  };

  return (
    <div className="guest-engagement">
      <button type="button" className="guest-engagement-button" aria-pressed={liked} disabled={likeBusy} onClick={() => void toggleLike()}>
        <span aria-hidden="true">{liked ? "♥" : "♡"}</span> 喜歡 <span>{likeCount}</span>
      </button>
      {onReply ? <button type="button" className="guest-engagement-button" aria-expanded={replying} onClick={onReply}>{replying ? "取消回覆" : "回覆"}</button> : null}
      <button type="button" className="guest-engagement-button" onClick={() => void share()}>分享連結</button>
      <span className="guest-engagement-status" role="status" aria-live="polite">{shareStatus}</span>
    </div>
  );
}
