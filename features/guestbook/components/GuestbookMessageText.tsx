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
      {message.editedAt ? <small className="guest-edited">此留言曾由店家編輯</small> : null}
    </>
  );
}
