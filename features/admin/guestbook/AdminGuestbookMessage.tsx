import { Menu } from "@base-ui/react/menu";
import { Eye, EyeOff, MessageSquare, MoreHorizontal, Pencil, Pin } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  pinControls?: ReactNode;
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const controlsDisabled = busy || loading;
  const threadVisible = root ? message.isVisible : (props.threadVisible ?? true);
  const canShare = threadVisible && message.isVisible;
  const visibilityLabel = message.isVisible ? (root ? "隱藏整串" : "隱藏回覆") : "恢復顯示";
  const hasDetails = message.content.length > 100 || message.content.split("\n").length > 3 || Boolean(message.customerUid || message.editedAt);
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
    <article className={`adminGuestbookMessage${message.isVisible ? "" : " isHidden"}${root ? "" : " isReply"}`}>
      <div className="adminGuestbookMessageRow">
        <div className="adminGuestbookMessageMain">
          <header>
            <strong>{message.displayName}</strong>
            <span className="adminGuestbookBadge">{AUTHOR_LABELS[message.authorType]}</span>
            <time dateTime={message.createdAt}>{adminGuestbookTime(message.createdAt)}</time>
            {root && message.isPinned ? <span className="adminGuestbookBadge">置頂</span> : null}
            {!message.isVisible ? <span className="adminGuestbookBadge">{root ? "整串隱藏" : "回覆隱藏"}</span> : null}
            {root && !message.allowReplies ? <span className="adminGuestbookBadge">關閉回覆</span> : null}
            {root && message.hiddenReplyCount > 0 ? <span className="adminGuestbookBadge">隱藏回覆 {message.hiddenReplyCount}</span> : null}
          </header>
          <div className="adminGuestbookContentRow">
            {message.imageId ? (
              <a className="adminGuestbookThumbnail" href={`/api/admin/guestbook/images/${encodeURIComponent(message.imageId)}`} target="_blank" rel="noopener noreferrer" aria-label={`查看 ${message.displayName} 的留言圖片`}>
                {/* Authenticated media must bypass shared optimizer caches. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/guestbook/images/${encodeURIComponent(message.imageId)}`} alt="留言附件" width={72} height={72} loading="lazy" />
              </a>
            ) : null}
            <p id={`guestbook-content-${message.id}`} className={hasDetails && !detailsOpen ? "adminGuestbookContent isCollapsed" : "adminGuestbookContent"}>{message.content}</p>
          </div>
          {detailsOpen ? (
            <div className="adminGuestbookDetails">
              {message.customerUid ? <span>顧客 UID：{message.customerUid}</span> : null}
              {message.editedAt ? <span>店家編輯於 {adminGuestbookTime(message.editedAt)}</span> : null}
            </div>
          ) : null}
          <div className="adminGuestbookMeta">
            <span>喜歡 {message.likeCount}</span>
            {root ? <button type="button" className="adminGuestbookTextButton" disabled={controlsDisabled} aria-expanded={expanded === message.id} onClick={() => props.onToggleReplies(message)}><MessageSquare size={14} aria-hidden="true" />{expanded === message.id ? "收起回覆" : `回覆 ${message.replyCount}`}</button> : null}
            {hasDetails ? <button type="button" className="adminGuestbookTextButton" aria-expanded={detailsOpen} aria-controls={`guestbook-content-${message.id}`} onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? "收起資訊" : "全文與資訊"}</button> : null}
          </div>
        </div>
        <div className="adminGuestbookRowActions">
          {root ? <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={controlsDisabled || !message.allowReplies || !message.isVisible} onClick={() => props.onReply(message)}>回覆</button> : null}
          <button type="button" className={`${SECONDARY_BUTTON_CLASS} iconActionButton`} disabled={controlsDisabled} aria-label="編輯留言" title="編輯留言" onClick={() => props.onEdit(message)}><Pencil aria-hidden="true" /></button>
          <button type="button" className={`${SECONDARY_BUTTON_CLASS} iconActionButton`} disabled={controlsDisabled} aria-label={visibilityLabel} title={visibilityLabel} onClick={() => props.onModerate(message, { isVisible: !message.isVisible })}>{message.isVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button>
          {root ? <button type="button" className={`${SECONDARY_BUTTON_CLASS} iconActionButton`} disabled={controlsDisabled} aria-pressed={message.isPinned} aria-label={message.isPinned ? "取消置頂" : "置頂"} title={message.isPinned ? "取消置頂" : "置頂"} onClick={() => props.onModerate(message, { isPinned: !message.isPinned })}><Pin aria-hidden="true" /></button> : null}
          <Menu.Root>
            <Menu.Trigger className={`${SECONDARY_BUTTON_CLASS} iconActionButton`} disabled={controlsDisabled} aria-label="更多留言操作" title="更多操作"><MoreHorizontal aria-hidden="true" /></Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={6} align="end" className="adminGuestbookMenuPositioner">
                <Menu.Popup className="adminTheme adminGuestbookMenu" aria-label="留言操作">
                  {root ? <Menu.Item onClick={() => props.onModerate(message, { allowReplies: !message.allowReplies })}>{message.allowReplies ? "關閉回覆" : "開啟回覆"}</Menu.Item> : null}
                  {canShare ? <>
                    <Menu.Item render={<a href={sharePath} target="_blank" rel="noopener noreferrer" aria-label="預覽分享頁" />}>預覽分享頁</Menu.Item>
                    <Menu.Item onClick={() => void copyShareLink()}>複製分享連結</Menu.Item>
                  </> : <Menu.Item disabled>隱藏留言無法分享</Menu.Item>}
                  {root ? <Menu.Item onClick={() => props.onHistory(message)}>操作紀錄</Menu.Item> : null}
                  {message.imageId ? <Menu.Item className="adminGuestbookDangerAction" onClick={() => props.onRemoveImage(message)}>移除圖片</Menu.Item> : null}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          {root ? props.pinControls : null}
        </div>
      </div>
      {root && expanded === message.id ? (
        <div className="adminGuestbookReplies">
          {replyLoading ? <p role="status">正在讀取回覆…</p> : null}
          {replyError ? <p role="alert">{replyError}<button className={SECONDARY_BUTTON_CLASS} disabled={replyLoading || controlsDisabled} onClick={() => props.onReloadReplies(message)}>重試</button></p> : null}
          {replies?.items.map((reply) => <AdminGuestbookMessage {...props} key={reply.id} message={reply} root={false} pinControls={undefined} threadVisible={threadVisible} />)}
          {replies?.nextCursor ? <button className={SECONDARY_BUTTON_CLASS} disabled={replyLoading || controlsDisabled} onClick={() => props.onLoadMoreReplies(message)}>載入更多回覆</button> : null}
          {replies?.totalCount === 0 ? <p>目前沒有回覆。</p> : null}
        </div>
      ) : null}
      {shareStatus ? <p className="adminGuestbookActionStatus" role="status">{shareStatus}</p> : null}
    </article>
  );
}
