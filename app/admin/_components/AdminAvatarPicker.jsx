import { useEffect, useState } from 'react';
import { AdminButton } from './AdminShared.jsx';
import { ImageProcessingCanceledError } from './AdminImageProcessingProvider.jsx';
import { useAdminImageProcessing } from './AdminImageProcessingContext.js';
import { formatImageFileSize } from './adminImageProcessing.js';

const AVATAR_WIDTH = 1200;
const AVATAR_HEIGHT = 1500;
const AVATAR_CROP_CONFIG = Object.freeze({
  width: AVATAR_WIDTH,
  height: AVATAR_HEIGHT,
  aspect: 4 / 5,
  title: '調整頭像',
  description: `拖曳圖片決定裁切位置，使用縮放滑桿調整大小；輸出固定為 ${AVATAR_WIDTH} × ${AVATAR_HEIGHT}px WebP。`,
  hint: '裁切框比例為 4:5，適用於公開店員卡片及詳細資料頁。',
});
const AVATAR_OUTPUT = Object.freeze({
  fileType: 'image/webp',
  quality: 0.9,
  maxSizeMB: 1.2,
  maxWidthOrHeight: AVATAR_HEIGHT,
});

function originalImageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    const mediaMatch = url.pathname.match(/\/api\/client\/media\/([^/]+)/);
    if (mediaMatch) return `/api/admin-media/${encodeURIComponent(decodeURIComponent(mediaMatch[1]))}`;
    url.searchParams.set('variant', 'original');
    return url.href;
  } catch {
    return value;
  }
}

export function AdminAvatarPicker({ label = '頭像', value, pendingFile, onChange, onClear, hint, className = '', disabled = false, required = false, cropOnUpload = true }) {
  const [preview, setPreview] = useState(value || '');
  const [processing, setProcessing] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const { processImage } = useAdminImageProcessing();

  useEffect(() => {
    if (!pendingFile) {
      setPreview(value || '');
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile, value]);

  const runProcess = async (request, mode) => {
    setProcessing(mode);
    setError('');
    setStatus(mode === 'loading' ? '正在準備原始圖片…' : cropOnUpload ? '請在裁切框調整圖片…' : '正在轉換並壓縮圖片…');
    try {
      const processed = await processImage(request);
      onChange(processed);
      setStatus(request.crop
        ? `已裁切為 ${AVATAR_WIDTH} × ${AVATAR_HEIGHT}px WebP，檔案大小 ${formatImageFileSize(processed.size)}。`
        : `已轉為 WebP，檔案大小 ${formatImageFileSize(processed.size)}。`);
    } catch (processError) {
      if (processError instanceof ImageProcessingCanceledError) setStatus('');
      else {
        setError(processError?.message || '圖片處理失敗，請重新選擇。');
        setStatus('');
      }
    } finally {
      setProcessing('');
    }
  };

  const handleUpload = (file) => {
    if (!file) return;
    return runProcess({ file, crop: cropOnUpload, cropConfig: AVATAR_CROP_CONFIG, output: AVATAR_OUTPUT }, cropOnUpload ? 'cropping' : 'compressing');
  };

  const adjustImage = () => runProcess({
    file: pendingFile || undefined,
    sourceUrl: pendingFile ? undefined : originalImageUrl(value),
    sourceName: 'avatar',
    crop: true,
    cropConfig: AVATAR_CROP_CONFIG,
    output: AVATAR_OUTPUT,
  }, pendingFile ? 'cropping' : 'loading');

  return <div className={`adminImagePicker adminAvatarPicker ${className}`.trim()}>
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
        <AdminButton variant="ghost" onClick={adjustImage} disabled={!preview || Boolean(processing)}>{processing === 'loading' ? '讀取中…' : '調整圖片'}</AdminButton>
        <AdminButton variant="danger" onClick={() => { setStatus(''); setError(''); onClear(); }} disabled={!preview || Boolean(processing)}>刪除</AdminButton>
      </div> : null}
      {status ? <small className="adminFieldHint adminAvatarStatus" role="status">{status}</small> : null}
      {error ? <small className="adminImageProcessorError" role="alert">{error}</small> : null}
      {hint ? <small className="adminFieldHint">{hint}</small> : null}
    </div>;
}
