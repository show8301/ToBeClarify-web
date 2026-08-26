import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { AdminButton, AdminDialog } from './AdminShared.jsx';
import { AdminImageProcessingContext } from './AdminImageProcessingContext.js';
import { assertSupportedImage, compressImageFile, cropImageFile, imageFileName } from './adminImageProcessing.js';

const Cropper = lazy(() => import('react-easy-crop'));
const DEFAULT_CROP = Object.freeze({
  width: 1200,
  height: 1500,
  aspect: 4 / 5,
  title: '調整圖片',
  description: '',
  hint: '',
});

export class ImageProcessingCanceledError extends Error {
  constructor() {
    super('已取消圖片處理。');
    this.name = 'ImageProcessingCanceledError';
  }
}

export function AdminImageProcessingProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [cropSource, setCropSource] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const sourceUrlRef = useRef('');
  const activePromiseRef = useRef(null);

  const releaseSource = useCallback(() => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = '';
    setCropSource('');
  }, []);

  const closeRequest = useCallback((result, failure) => {
    const active = activePromiseRef.current;
    activePromiseRef.current = null;
    setRequest(null);
    setError('');
    releaseSource();
    if (failure) active?.reject(failure);
    else active?.resolve(result);
  }, [releaseSource]);

  const processImage = useCallback(async ({ file, sourceUrl, sourceName = 'image', crop: shouldCrop = false, cropConfig, output } = {}) => {
    let sourceFile = file;
    if (!sourceFile && sourceUrl) {
      const response = await fetch(sourceUrl, { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('無法取得資料庫中的原始圖片。');
      const blob = await response.blob();
      const type = blob.type || 'image/jpeg';
      sourceFile = new File([blob], imageFileName(sourceName, type), { type, lastModified: Date.now() });
    }
    assertSupportedImage(sourceFile);
    if (!shouldCrop) return compressImageFile(sourceFile, output);
    if (activePromiseRef.current) throw new Error('目前已有圖片正在處理。');

    const config = { ...DEFAULT_CROP, ...cropConfig };
    const url = URL.createObjectURL(sourceFile);
    sourceUrlRef.current = url;
    setCropSource(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropPixels(null);
    setError('');
    setRequest({ sourceName: sourceFile.name || sourceName, config, output });
    return new Promise((resolve, reject) => {
      activePromiseRef.current = { resolve, reject };
    });
  }, []);

  const cancel = useCallback(() => {
    if (processing) return;
    closeRequest(null, new ImageProcessingCanceledError());
  }, [closeRequest, processing]);

  const applyCrop = async () => {
    if (!request) return;
    setProcessing(true);
    setError('');
    try {
      const result = await cropImageFile(cropSource, cropPixels, request.sourceName, {
        ...request.output,
        width: request.config.width,
        height: request.config.height,
      });
      closeRequest(result);
    } catch (cropError) {
      setError(cropError?.message || '圖片裁切失敗，請重新調整。');
    } finally {
      setProcessing(false);
    }
  };

  const service = useMemo(() => ({ processImage }), [processImage]);
  const config = request?.config || DEFAULT_CROP;

  return <AdminImageProcessingContext.Provider value={service}>
    {children}
    <AdminDialog
      className="adminImageCropDialog"
      open={Boolean(request)}
      title={config.title}
      description={config.description || `拖曳圖片決定裁切位置；輸出固定為 ${config.width} × ${config.height}px WebP。`}
      onClose={cancel}
      actions={<><AdminButton variant="ghost" onClick={cancel} disabled={processing}>取消</AdminButton><AdminButton onClick={applyCrop} disabled={!cropPixels || processing}>{processing ? '處理中…' : '套用裁切'}</AdminButton></>}
    >
      <div className="adminImageCropWorkspace">
        <div className="adminImageCropStage">
          {cropSource ? <Suspense fallback={<div className="adminImageCropLoading">正在載入裁切工具…</div>}><Cropper image={cropSource} crop={crop} zoom={zoom} aspect={config.aspect} objectFit="contain" showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCropPixels(pixels)} /></Suspense> : null}
        </div>
        <label className="adminImageZoomControl">
          <span>縮放</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          <output>{Math.round(zoom * 100)}%</output>
        </label>
        <p>{config.hint || `裁切比例為 ${config.width}:${config.height}，輸出格式固定為 WebP。`}</p>
        {error ? <small className="adminImageProcessorError" role="alert">{error}</small> : null}
      </div>
    </AdminDialog>
  </AdminImageProcessingContext.Provider>;
}
