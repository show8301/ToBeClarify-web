import imageCompression from "browser-image-compression";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CompressedGuestbookImage = {
  base64: string;
  previewUrl: string;
  size: number;
};

export async function compressGuestbookImage(file: File): Promise<CompressedGuestbookImage> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error("圖片僅支援 JPEG、PNG 或 WebP 格式。");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("原始圖片不可超過 15 MB，請先縮小後再上傳。");
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1600,
    initialQuality: 0.84,
    fileType: "image/webp",
    useWebWorker: true,
  });
  if (compressed.size > 2 * 1024 * 1024) {
    throw new Error("壓縮後圖片仍超過 2 MB，請改選較小的圖片。");
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("無法讀取處理後的圖片。"));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("圖片讀取失敗，請重新選擇。"));
    reader.readAsDataURL(compressed);
  });

  return { base64, previewUrl: `data:image/webp;base64,${base64}`, size: compressed.size };
}
