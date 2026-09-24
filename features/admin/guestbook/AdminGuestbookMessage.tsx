import { useState } from "react";
import { SECONDARY_BUTTON_CLASS, AUTHOR_LABELS, adminGuestbookTime } from "@/features/admin/guestbook/presentation";
import type { GuestbookMessage, GuestbookReplies } from "@/features/guestbook/types";

type ModerationChange = Partial<Pick<GuestbookMessage, "isVisible" | "isPinned" | "allowReplies">>;

type AdminGuestbookMessageProps = {
  message: GuestbookMessage;
  root?: boolean;
  busy: boolean;
  loading: boolean;
  expanded: string | null;
  replies: GuestbookReplies | null;
  replyLoading: boolean;
  replyError: string;
  onEdit: (message: GuestbookMessage) => void;
  onModerate: (message: GuestbookMessage, change: ModerationChange) => void;
  onRemoveImage: (message: GuestbookMessage) => void;
  onReply: (message: GuestbookMessage) => void;
  onToggleReplies: (message: GuestbookMessage) => void;
  onReloadReplies: (message: GuestbookMessage) => void;
  onLoadMoreReplies: (message: GuestbookMessage) => void;
  onHistory: (message: GuestbookMessage) => void;
  threadVisible?: boolean;
};

export function AdminGuestbookMessage(props: AdminGuestbookMessageProps) {
  const { message, root = true, busy, loading, expanded, replies, replyLoading, replyError } = props;
  const [shareStatus, setShareStatus] = useState("");
  const controlsDisabled = busy || loading;
  const threadVisible = root ? message.isVisible : (props.threadVisible ?? true);
  const canShare = threadVisible && message.isVisible;
  const sharePath = "/guestbook/thread/" + encodeURIComponent(message.threadId)
    + (message.id === message.threadId ? "" : "?reply=" + encodeURIComponent(message.id));
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(sharePath, window.location.origin).toString());
      setShareStatus("分享連結已複製。");
    } catch {
      setShareStatus("無法複製連結，請使用預覽頁網址分享。");
    }
  };

  return (
    <div className={`adminGuestbookMessage${message.isVisible ? "" : " isHidden"}`}>
      <header>
        <strong>{message.displayName}</strong>
        <span className="adminGuestbookBadge">{AUTHOR_LABELS[message.authorType]}</span>
        <time>{adminGuestbookTime(message.createdAt)}</time>
      </header>
      <p>{message.content}</p>
      {message.customerUid ? <p>顧客 UID：{message.customerUid}</p> : null}
      {message.imageId ? <a href={`/api/admin/guestbook/images/${encodeURIComponent(message.imageId)}`} target="_blank" rel="noopener noreferrer">
        {/* Authenticated media must bypass shared optimizer caches. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/admin/guestbook/images/${encodeURIComponent(message.imageId)}`} alt="留言附件" loading="lazy" style={{ maxWidth: "100%", maxHeight: 280, objectFit: "contain" }} />
      </a> : null}
      <div className="adminGuestbookMeta">
        {!message.isVisible ? <span>已隱藏{root ? "整串" : ""}</span> : null}
        {root && !message.allowReplies ? <span>已關閉回覆</span> : null}
        {message.editedAt ? <span>店家編輯於 {adminGuestbookTime(message.editedAt)}</span> : null}
        <span>喜歡 {message.likeCount}</span>
        {root && message.hiddenReplyCount > 0 ? <span>含 {message.hiddenReplyCount} 則隱藏回覆</span> : null}
      </div>
      <div className="adminGuestbookActions">
        <button className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled} onClick={() => props.onEdit(message)}>編輯</button>
        <button className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled} onClick={() => props.onModerate(message, { isVisible: !message.isVisible })}>
          {message.isVisible ? (root ? "隱藏整串" : "隱藏回覆") : "恢復顯示"}
        </button>
        {message.imageId ? (
          <button className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled} onClick={() => props.onRemoveImage(message)}>移除圖片</button>
        ) : null}
        {canShare ? (
          <>
            <a className={SECONDARY_BUTTON_CLASS} href={sharePath} target="_blank" rel="noopener noreferrer">預覽分享頁</a>
            <button className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled} onClick={() => void copyShareLink()}>複製分享連結</button>
          </>
        ) : (
          <span className="adminGuestbookMeta">隱藏留言不提供分享連結</span>
        )}
        {root ? (
          <>
            <button className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled} onClick={() => props.onModerate(message, { allowReplies: !message.allowReplies })}>
              {message.allowReplies ? "關閉回覆" : "開啟回覆"}
            </button>
            <button className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled} onClick={() => props.onModerate(message, { isPinned: !message.isPinned })}>
              {message.isPinned ? "取消置頂" : "置頂"}
            </button>
            <button
              className={SECONDARY_BUTTON_CLASS}
              disabled={controlsDisabled || !message.allowReplies || !message.isVisible}
              onClick={() => props.onReply(message)}
            >
              回覆這一串
            </button>
            <button
              className={SECONDARY_BUTTON_CLASS}
              disabled={controlsDisabled}
              aria-expanded={expanded === message.id}
              onClick={() => props.onToggleReplies(message)}
            >
              {expanded === message.id ? "收起" : `查看 ${message.replyCount} 則回覆`}
            </button>
            <button className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled} onClick={() => props.onHistory(message)}>
              操作紀錄
            </button>
          </>
        ) : null}
      </div>
      {root && expanded === message.id ? (
        <div className="adminGuestbookReplies">
          {replyLoading ? <p role="status">正在讀取回覆…</p> : null}
          {replyError ? (
            <p role="alert">
              {replyError}
              <button className={SECONDARY_BUTTON_CLASS} onClick={() => props.onReloadReplies(message)}>重試</button>
            </p>
          ) : null}
          {replies?.items.map((reply) => (
            <AdminGuestbookMessage
              {...props}
              key={reply.id}
              message={reply}
              root={false}
              threadVisible={threadVisible}
            />
          ))}
          {replies?.nextCursor ? (
            <button className={SECONDARY_BUTTON_CLASS} disabled={replyLoading || controlsDisabled} onClick={() => props.onLoadMoreReplies(message)}>
              載入更多回覆
            </button>
          ) : null}
          {replies?.totalCount === 0 ? <p>目前沒有回覆。</p> : null}
        </div>
      ) : null}
      {shareStatus ? <p className="adminGuestbookActionStatus" role="status">{shareStatus}</p> : null}
    </div>
  );
}
