"use client";

import { useEffect, useRef, useState } from "react";
import type { GuestbookSubmission } from "@/features/guestbook/types";

type GuestbookComposerProps = {
  onSubmit: (input: GuestbookSubmission) => Promise<boolean>;
  busy: boolean;
  cooldown: number;
  initialName: string;
  reply?: boolean;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function GuestbookComposer({ onSubmit, busy, cooldown, initialName, reply }: GuestbookComposerProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [customerUid, setCustomerUid] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [reading, setReading] = useState(false);
  const reader = useRef<FileReader | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const canAttach = customerUid.trim().length > 0;
  const buttonLabel = busy ? "正在送出…" : cooldown > 0 ? "請等待 " + cooldown + " 秒" : reply ? "留下回覆 ↗" : "SEND TO THE DREAM ↗";

  useEffect(() => () => {
    if (reader.current) {
      reader.current.onload = null;
      reader.current.onerror = null;
      reader.current.abort();
    }
  }, []);

  const chooseImage = (file?: File) => {
    reader.current?.abort();
    setImage(null);
    setImageError("");
    setReading(false);
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || file.size > 2 * 1024 * 1024) {
      setImageError("請選擇 2 MB 以下的 JPEG、PNG 或 WebP 圖片。");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const current = new FileReader();
    reader.current = current;
    setReading(true);
    current.onload = () => {
      if (reader.current !== current) return;
      setImage(typeof current.result === "string" ? current.result : null);
      setReading(false);
    };
    current.onerror = () => {
      if (reader.current !== current) return;
      setImageError("圖片讀取失敗，請重新選擇。");
      setReading(false);
    };
    current.readAsDataURL(file);
  };

  return (
    <form className={reply ? "guest-inline-reply" : undefined} onSubmit={async (event) => {
      event.preventDefault();
      const uid = customerUid.trim();
      if (image && !uid) {
        setImageError("附圖留言需要顧客 UID。文字留言可以留空 UID 匿名送出。");
        return;
      }
      const success = await onSubmit({
        displayName: name.trim() || "匿名旅人",
        content,
        website,
        ...(uid ? { customerUid: uid } : {}),
        ...(uid && image ? { imageBase64: image.slice(image.indexOf(",") + 1) } : {}),
      });
      if (success) {
        setContent("");
        setImage(null);
        if (fileInput.current) fileInput.current.value = "";
      }
    }}>
      <label><span>旅人名字（可不填）</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="nickname" placeholder="不填將顯示匿名旅人" /></label>
      <label><span>{reply ? "回覆內容" : "想留下的話"}</span><textarea value={content} onChange={(event) => setContent(event.target.value)} required maxLength={2000} placeholder="説説這次夢境的心得..." /></label>
      <div className="guest-identity-options">
        <label><span>顧客 UID（附圖留言必填，文字留言可留空）</span><input value={customerUid} onChange={(event) => { setCustomerUid(event.target.value); setImageError(""); }} maxLength={40} autoComplete="off" placeholder="例如 C-..." /></label>
        <p>UID 是長期顧客識別碼；留言不需要登入。知道 UID 的人可以使用該 UID 發表圖片留言。</p>
        {canAttach ? <label><span>附上圖片（選填，2 MB 以下）</span><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || reading} onChange={(event) => chooseImage(event.target.files?.[0])} /></label> : null}
        {canAttach && image ? <div className="guest-image-preview">
          {/* Local data URL is a temporary, bounded preview. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="即將公開的留言附件預覽" />
          <button type="button" disabled={busy} onClick={() => { chooseImage(); if (fileInput.current) fileInput.current.value = ""; }}>移除圖片</button>
          <p>送出後，圖片會隨留言公開。</p>
        </div> : null}
        {imageError ? <p role="alert">{imageError}</p> : null}
      </div>
      <div className="guest-honeypot" aria-hidden="true"><label>Website<input name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" maxLength={200} /></label></div>
      <button disabled={busy || reading || cooldown > 0}>{reading ? "正在讀取圖片…" : buttonLabel}</button>
    </form>
  );
}
