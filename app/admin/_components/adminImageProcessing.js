export const DEFAULT_IMAGE_OUTPUT = Object.freeze({
  fileType: 'image/webp',
  quality: 0.9,
  maxSizeMB: 1.8,
  maxWidthOrHeight: 2400,
});

export const SUPPORTED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export function assertSupportedImage(file) {
  if (!file || !SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('圖片僅支援 JPEG、PNG 或 WebP 格式。');
  }
}

export function imageFileName(name = 'image', fileType = DEFAULT_IMAGE_OUTPUT.fileType) {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  if (fileType === 'image/webp') return `${base}.webp`;
  if (fileType === 'image/png') return `${base}.png`;
  return `${base}.jpg`;
}

export function formatImageFileSize(size) {
  if (!Number.isFinite(size)) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export async function compressImageFile(file, output = {}) {
  assertSupportedImage(file);
  const options = { ...DEFAULT_IMAGE_OUTPUT, ...output };
  const { default: imageCompression } = await import('browser-image-compression');
  const compressed = await imageCompression(file, {
    maxSizeMB: options.maxSizeMB,
    maxWidthOrHeight: options.maxWidthOrHeight,
    initialQuality: options.quality,
    fileType: options.fileType,
    useWebWorker: true,
  });
  return new File([compressed], imageFileName(file.name, options.fileType), {
    type: options.fileType,
    lastModified: Date.now(),
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('無法讀取圖片內容。'));
    image.src = source;
  });
}

function canvasBlob(canvas, fileType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('無法產生裁切圖片。')),
      fileType,
      quality,
    );
  });
}

export async function cropImageFile(source, cropPixels, sourceName, output) {
  if (!cropPixels?.width || !cropPixels?.height) throw new Error('請先完成圖片裁切範圍。');
  const options = { ...DEFAULT_IMAGE_OUTPUT, ...output };
  if (!options.width || !options.height) throw new Error('裁切輸出尺寸尚未設定。');

  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('目前瀏覽器無法處理圖片裁切。');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    options.width,
    options.height,
  );
  const blob = await canvasBlob(canvas, options.fileType, options.quality);
  return new File([blob], imageFileName(sourceName, options.fileType), {
    type: options.fileType,
    lastModified: Date.now(),
  });
}
