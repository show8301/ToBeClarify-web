"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { compressGuestbookImage } from "@/lib/guestbook-image";
import type { GuestbookSubmission } from "@/features/guestbook/types";

type GuestbookComposerProps = {
  onSubmit: (input: GuestbookSubmission) => Promise<boolean>;
  busy: boolean;
  cooldown: number;
  initialName: string;
  reply?: boolean;
};

export function GuestbookComposer({ onSubmit, busy, cooldown, initialName, reply }: GuestbookComposerProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [customerUid, setCustomerUid] = useState("");
  const [image, setImage] = useState<{ base64: string; previewUrl: string; size: number } | null>(null);
  const [imageError, setImageError] = useState("");
  const [reading, setReading] = useState(false);
  const imageRequest = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const attachmentOptions = useRef<HTMLDetailsElement | null>(null);
  const buttonLabel = busy
    ? "正在送出…"
    : cooldown > 0
      ? "請等待 " + cooldown + " 秒"
      : reply
        ? image ? "發佈回覆與圖片" : "留下回覆"
        : image ? "發佈留言與圖片" : "發佈留言";

  useEffect(() => () => { imageRequest.current += 1; }, []);

  const chooseImage = async (file?: File) => {
    const requestId = ++imageRequest.current;
    setImage(null);
    setImageError("");
    setReading(false);
    if (!file) return;
    setReading(true);
    try {
      const compressed = await compressGuestbookImage(file);
      if (requestId === imageRequest.current) {
        setImage(compressed);
        if (attachmentOptions.current) attachmentOptions.current.open = true;
      }
    } catch (cause) {
      if (requestId === imageRequest.current) {
        setImageError(cause instanceof Error ? cause.message : "圖片處理失敗，請重新選擇。");
        if (fileInput.current) fileInput.current.value = "";
      }
    } finally {
      if (requestId === imageRequest.current) setReading(false);
    }
  };

  return (
    <form className={reply ? "guest-inline-reply" : undefined} onSubmit={async (event) => {
      event.preventDefault();
      const uid = customerUid.trim();
      if (image && !uid) {
        setImageError("附圖需要顧客 UID；補上 UID，或移除圖片後送出文字留言。");
        return;
      }
      const success = await onSubmit({
        displayName: name.trim() || "匿名旅人",
        content,
        website,
        ...(uid && image ? { customerUid: uid, imageBase64: image.base64 } : {}),
      });
      if (success) {
        setContent("");
        setImage(null);
        setCustomerUid("");
        if (fileInput.current) fileInput.current.value = "";
      }
    }}>
      <div className="guest-writing-panel">
        {!reply ? <h3>免登入留言</h3> : null}
        <label><span>旅人名字</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="nickname" placeholder="如何稱呼你？（可不填）" /></label>
        <label><span>{reply ? "回覆內容" : "留言內容"}</span><textarea value={content} onChange={(event) => setContent(event.target.value)} required maxLength={2000} placeholder={reply ? "回覆內容..." : "說說這次夢境的心得..."} /></label>
        <details className="guest-identity-options" ref={attachmentOptions}>
          <summary>加入圖片（選填）</summary>
          <p>圖片會與這則{reply ? "回覆" : "留言"}一起發佈；附圖需填寫顧客 UID。</p>
          <label className="guest-uid-field"><span>顧客 UID（附圖必填）</span><input aria-invalid={Boolean(imageError && image && !customerUid.trim())} value={customerUid} onChange={(event) => { setCustomerUid(event.target.value); setImageError(""); }} maxLength={40} autoComplete="off" placeholder="輸入顧客 UID" /></label>
          <div className="guest-upload-controls">
            <button className="guest-upload-zone" type="button" disabled={busy || reading} onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy && !reading) void chooseImage(event.dataTransfer.files[0]); }}>
              <ImagePlus size={22} aria-hidden="true" /><span>{image ? "更換圖片" : "選擇圖片或拖曳至此"}<small>支援 JPG、PNG、WebP</small></span>
            </button>
            <input className="guest-sr-only" aria-label="選擇留言圖片" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || reading} tabIndex={-1} onChange={(event) => void chooseImage(event.target.files?.[0])} />
          </div>
          {image ? <div className="guest-image-preview">
            {/* Local data URL is a temporary, bounded preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.previewUrl} alt="即將公開的留言附件預覽" />
            <button type="button" disabled={busy} onClick={() => { void chooseImage(); if (fileInput.current) fileInput.current.value = ""; }}>移除圖片</button>
            <p>圖片尚未發佈，壓縮後 {(image.size / 1024).toFixed(0)} KB，送出後會與{reply ? "回覆" : "留言"}一起公開。</p>
          </div> : null}
          {reading ? <p role="status">正在壓縮圖片…</p> : null}
          {imageError ? <p role="alert">{imageError}</p> : null}
        </details>
      </div>
      <button className="guest-submit" disabled={busy || reading || cooldown > 0}>{reading ? "正在讀取圖片…" : buttonLabel}<Send size={16} aria-hidden="true" /></button>
      <div className="guest-honeypot" aria-hidden="true"><label>Website<input name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" maxLength={200} /></label></div>
    </form>
  );
}
