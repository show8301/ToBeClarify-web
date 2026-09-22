"use client";

import { useEffect, useRef, useState } from "react";
import { collectionApi, safeCloudUrl } from "../api";
import type { CollectionAccess, CollectionAsset as Asset } from "../types";

type Props = { workId: string; asset: Asset; access: CollectionAccess };

function PrivateImage({ workId, asset, access }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "180px" });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    collectionApi.image(workId, asset.id, access, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "圖片載入失敗，請重新查詢。");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [workId, asset.id, access, visible]);

  const extension = asset.contentType?.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const filename = `${asset.label.replace(/[\\/:*?"<>|]/g, "_") || "清醒夢作品"}.${extension}`;
  return (
    <div className="collectionAsset" ref={containerRef}>
      {imageUrl ? <>
        {/* An authenticated blob is already decoded locally; image optimization cannot forward its credential. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={asset.label} />
        <a className="collectionButton collectionSecondary" href={imageUrl} download={filename}>下載作品圖片</a>
      </> : visible ? <p className="collectionImagePlaceholder" role="status">{error || "正在讀取您的作品圖片…"}</p> : <button className="collectionSecondary collectionImagePlaceholder" type="button" onClick={() => setVisible(true)}>查看作品圖片</button>}
      <p>{asset.label}</p>
      {asset.byteSize > 0 && <small className="collectionFineprint">{(asset.byteSize / 1024 / 1024).toLocaleString("zh-TW", { maximumFractionDigits: 1 })} MB</small>}
    </div>
  );
}

export default function CollectionAsset(props: Props) {
  if (props.asset.kind === "image") return <PrivateImage {...props} />;
  const url = safeCloudUrl(props.asset.url);
  return (
    <div className="collectionAsset">
      <p><strong>{props.asset.label}</strong></p>
      {url ? <>
        <p className="collectionFineprint">雲端交付 · {new URL(url).hostname}</p>
        <a className="collectionButton collectionSecondary" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">開啟雲端作品 ↗</a>
      </> : <p role="status">此附件連結暫時無法使用，請聯絡店員。</p>}
    </div>
  );
}
