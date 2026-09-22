import type { GuestbookMessage } from "@/features/guestbook/types";

export function guestbookDateLabel(value: string) {
  const zoned = /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}+08:00`;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(new Date(zoned));
}

export function GuestbookMessageText({ message }: { message: GuestbookMessage }) {
  return (
    <>
      <p>{message.content}</p>
      {message.customerUid ? <small className="guest-verified">使用顧客 UID 留言</small> : null}
      {message.imageId ? (
        <a href={`/api/guestbook/images/${encodeURIComponent(message.imageId)}`} target="_blank" rel="noopener noreferrer" className="guest-message-image">
          {/* Protected media is served through the same-origin route without image optimization caching. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/guestbook/images/${encodeURIComponent(message.imageId)}`} alt={`${message.displayName} 分享的留言圖片`} loading="lazy" />
        </a>
      ) : null}
      {message.editedAt ? <small className="guest-edited">此留言曾由店家編輯</small> : null}
    </>
  );
}
