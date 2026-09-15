"use client";

import { useState } from "react";

type GuestbookComposerProps = {
  onSubmit: (name: string, content: string, website: string) => Promise<boolean>;
  busy: boolean;
  cooldown: number;
  initialName: string;
  reply?: boolean;
};

export function GuestbookComposer({ onSubmit, busy, cooldown, initialName, reply }: GuestbookComposerProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const buttonLabel = busy
    ? "正在送出…"
    : cooldown > 0
      ? `請等待 ${cooldown} 秒`
      : reply
        ? "留下回覆 ↗"
        : "SEND TO THE DREAM ↗";

  return (
    <form
      className={reply ? "guest-inline-reply" : undefined}
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onSubmit(name, content, website)) setContent("");
      }}
    >
      <label>
        <span>旅人名字</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={60}
          autoComplete="nickname"
          placeholder="如何稱呼你？"
        />
      </label>
      <label>
        <span>{reply ? "回覆內容" : "想留下的話"}</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          maxLength={2000}
          placeholder="説説這次夢境的心得..."
        />
      </label>
      <div className="guest-honeypot" aria-hidden="true">
        <label>
          Website
          <input
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            maxLength={200}
          />
        </label>
      </div>
      <button disabled={busy || cooldown > 0}>{buttonLabel}</button>
    </form>
  );
}
