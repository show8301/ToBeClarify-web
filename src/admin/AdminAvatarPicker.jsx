import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { AdminButton, AdminDialog } from './AdminShared.jsx';

const AVATAR_ASPECT = 4 / 5;
const AVATAR_WIDTH = 1200;
const AVATAR_HEIGHT = 1500;
const CLIENT_API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim()
  || 'https://api.marchgroup.net/api/client'
).replace(/\/$/, '');
const UPLOAD_OPTIONS = {
  maxSizeMB: 1.8,
  maxWidthOrHeight: 2400,
  initialQuality: 0.9,
  useWebWorker: true,
};
const CROPPED_OPTIONS = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: AVATAR_HEIGHT,
  initialQuality: 0.9,
  fileType: 'image/webp',
  useWebWorker: true,
};

async function compressImage(file, options) {
  const { default: imageCompression } = await import('browser-image-compression');
  const compressed = await imageCompression(file, options);
  if (compressed instanceof File) return compressed;
  return new File([compressed], file.name, { type: compressed.type || file.type, lastModified: Date.now() });
}

function originalImageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    const mediaMatch = url.pathname.match(/\/api\/client\/media\/([^/]+)/);
    if (mediaMatch) {
      const mediaId = encodeURIComponent(decodeURIComponent(mediaMatch[1]));
      return `${CLIENT_API_BASE_URL}/media/${mediaId}?variant=original`;
    }
    url.searchParams.set('variant', 'original');
    return url.href;
  } catch {
    return value;
  }
}

function fileNameFor(type, name = 'avatar') {
  const base = name.replace(/\.[^.]+$/, '') || 'avatar';
  if (type === 'image/png') return `${base}.png`;
  if (type === 'image/webp') return `${base}.webp`;
  return `${base}.jpg`;
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('無法讀取圖片內容。'));
    image.src = source;
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('無法產生裁切圖片。')), 'image/webp', 0.92);
  });
}

async function cropAvatar(source, cropPixels, sourceName) {
  if (!cropPixels?.width || !cropPixels?.height) throw new Error('請先完成圖片裁切範圍。');
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_WIDTH;
  canvas.height = AVATAR_HEIGHT;
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
    AVATAR_WIDTH,
    AVATAR_HEIGHT,
  );
  const blob = await canvasBlob(canvas);
  const cropped = new File([blob], fileNameFor('image/webp', sourceName), { type: 'image/webp', lastModified: Date.now() });
  return compressImage(cropped, CROPPED_OPTIONS);
}

export function AdminAvatarPicker({ label = '頭像', value, pendingFile, onChange, onClear, hint, className = '', disabled = false, required = false }) {
  const [preview, setPreview] = useState(value || '');
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSource, setCropSource] = useState('');
  const [cropSourceName, setCropSourceName] = useState('avatar');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const [processing, setProcessing] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const cropSourceRef = useRef('');

  const replaceCropSource = useCallback((file) => {
    if (cropSourceRef.current) URL.revokeObjectURL(cropSourceRef.current);
    const url = URL.createObjectURL(file);
    cropSourceRef.current = url;
    setCropSource(url);
    setCropSourceName(file.name || 'avatar');
  }, []);

  useEffect(() => {
    if (!pendingFile) {
      setPreview(value || '');
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile, value]);

  useEffect(() => () => {
    if (cropSourceRef.current) URL.revokeObjectURL(cropSourceRef.current);
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('頭像僅支援 JPEG、PNG 或 WebP 圖片。');
      return;
    }
    setProcessing('compressing');
    setError('');
    setStatus('正在壓縮圖片並保留高畫質…');
    try {
      const compressed = await compressImage(file, UPLOAD_OPTIONS);
      onChange(compressed);
      setStatus(`已壓縮：${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}，可按「調整圖片」裁切。`);
    } catch (uploadError) {
      setError(uploadError?.message || '圖片壓縮失敗，請換一張圖片再試。');
      setStatus('');
    } finally {
      setProcessing('');
    }
  };

  const openCropEditor = async () => {
    if (!pendingFile && !value) return;
    setProcessing('loading');
    setError('');
    setStatus('正在準備原始圖片…');
    try {
      let sourceFile = pendingFile;
      if (!sourceFile) {
        const response = await fetch(originalImageUrl(value), { credentials: 'omit', cache: 'no-store' });
        if (!response.ok) throw new Error('無法取得資料庫中的原始頭像。');
        const blob = await response.blob();
        const fetched = new File([blob], fileNameFor(blob.type), { type: blob.type || 'image/jpeg', lastModified: Date.now() });
        sourceFile = await compressImage(fetched, UPLOAD_OPTIONS);
      }
      replaceCropSource(sourceFile);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropPixels(null);
      setCropOpen(true);
      setStatus('');
    } catch (cropError) {
      setError(cropError?.message || '無法開啟圖片調整工具。');
      setStatus('');
    } finally {
      setProcessing('');
    }
  };

  const closeCropEditor = () => {
    if (processing === 'cropping') return;
    setCropOpen(false);
  };

  const applyCrop = async () => {
    setProcessing('cropping');
    setError('');
    try {
      const croppedFile = await cropAvatar(cropSource, cropPixels, cropSourceName);
      onChange(croppedFile);
      setStatus(`已裁切為 ${AVATAR_WIDTH} × ${AVATAR_HEIGHT}px（4:5），檔案大小 ${formatFileSize(croppedFile.size)}。`);
      setCropOpen(false);
    } catch (cropError) {
      setError(cropError?.message || '圖片裁切失敗，請重新調整。');
    } finally {
      setProcessing('');
    }
  };

  const removeImage = () => {
    setError('');
    setStatus('頭像已從草稿移除，儲存店員資料後才會正式生效。');
    onClear();
  };

  return <>
    <div className={`adminImagePicker adminAvatarPicker ${className}`.trim()}>
      <div className="adminImagePickerHeader">
        <span>{label}{required ? <b className="adminRequiredMark" aria-hidden="true">*</b> : null}</span>
        {pendingFile ? <small>已在本機處理，儲存時才會上傳</small> : null}
      </div>
      <div className="adminImagePreview adminAvatarPreview">
        {preview ? <img src={preview} alt="頭像預覽" /> : <span>尚無頭像</span>}
      </div>
      {!disabled ? <div className="adminImagePickerActions adminAvatarActions">
        <label className={`adminButton adminButton-secondary${processing ? ' isDisabled' : ''}`}>
          {processing === 'compressing' ? '壓縮中…' : '上傳圖片'}
          <input type="file" disabled={Boolean(processing)} accept="image/jpeg,image/png,image/webp" onChange={(event) => { handleUpload(event.target.files?.[0] || null); event.target.value = ''; }} />
        </label>
        <AdminButton variant="ghost" onClick={openCropEditor} disabled={!preview || Boolean(processing)}>{processing === 'loading' ? '讀取中…' : '調整圖片'}</AdminButton>
        <AdminButton variant="danger" onClick={removeImage} disabled={!preview || Boolean(processing)}>刪除</AdminButton>
      </div> : null}
      {status ? <small className="adminFieldHint adminAvatarStatus" role="status">{status}</small> : null}
      {error ? <small className="adminAvatarError" role="alert">{error}</small> : null}
      {hint ? <small className="adminFieldHint">{hint}</small> : null}
    </div>

    <AdminDialog
      className="adminAvatarCropDialog"
      open={cropOpen}
      title="調整頭像"
      description={`拖曳圖片決定裁切位置，使用縮放滑桿調整大小；輸出固定為 ${AVATAR_WIDTH} × ${AVATAR_HEIGHT}px。`}
      onClose={closeCropEditor}
      actions={<><AdminButton variant="ghost" onClick={closeCropEditor} disabled={processing === 'cropping'}>取消</AdminButton><AdminButton onClick={applyCrop} disabled={!cropPixels || processing === 'cropping'}>{processing === 'cropping' ? '處理中…' : '套用裁切'}</AdminButton></>}
    >
      <div className="adminAvatarCropWorkspace">
        <div className="adminAvatarCropStage">
          {cropSource ? <Cropper image={cropSource} crop={crop} zoom={zoom} aspect={AVATAR_ASPECT} objectFit="contain" showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCropPixels(pixels)} /> : null}
        </div>
        <label className="adminAvatarZoomControl">
          <span>縮放</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          <output>{Math.round(zoom * 100)}%</output>
        </label>
        <p>裁切框比例為 4:5，適用於公開店員卡片及詳細資料頁。</p>
        {error ? <small className="adminAvatarError" role="alert">{error}</small> : null}
      </div>
    </AdminDialog>
  </>;
}
