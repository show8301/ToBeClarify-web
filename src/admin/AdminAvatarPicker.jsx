import { useEffect, useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { AdminButton, AdminDialog, AdminImagePicker } from './AdminShared.jsx';

const CROP_WIDTH = 640;
const CROP_HEIGHT = 800;

function canvasToFile(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('無法產生裁切後的圖片，請重新選擇圖片。'));
        return;
      }

      const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
      resolve(new File([blob], `staff-avatar.${extension}`, {
        type: blob.type,
        lastModified: Date.now(),
      }));
    }, 'image/webp', 0.9);
  });
}

export function AdminAvatarPicker({ label = '頭像', value, pendingFile, onChange, onClear, hint, className = '', disabled = false }) {
  const [sourceFile, setSourceFile] = useState(null);

  const closeEditor = () => setSourceFile(null);
  const confirmEditor = (file) => {
    onChange(file);
    closeEditor();
  };

  return (
    <>
      <AdminImagePicker
        label={label}
        value={value}
        pendingFile={pendingFile}
        onChange={(file) => file && setSourceFile(file)}
        onClear={onClear}
        hint={hint}
        className={className}
        disabled={disabled}
      />
      <AdminAvatarCropDialog file={sourceFile} onClose={closeEditor} onConfirm={confirmEditor} />
    </>
  );
}

function AdminAvatarCropDialog({ file, onClose, onConfirm }) {
  const editorRef = useRef(null);
  const [scale, setScale] = useState(1.05);
  const [rotate, setRotate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) return;
    setScale(1.05);
    setRotate(0);
    setSaving(false);
    setError('');
  }, [file]);

  if (!file) return null;

  const resetEditor = () => {
    setScale(1.05);
    setRotate(0);
    setError('');
  };

  const saveCrop = async () => {
    const canvas = editorRef.current?.getImageScaledToCanvas();
    if (!canvas) {
      setError('圖片尚未載入完成，請稍候再試。');
      return;
    }

    setSaving(true);
    setError('');
    try {
      onConfirm(await canvasToFile(canvas));
    } catch (cropError) {
      setError(cropError.message || '圖片裁切失敗，請重新嘗試。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      open
      className="adminAvatarCropDialog"
      title="調整店員頭像"
      description="拖曳圖片調整位置，並使用縮放或旋轉工具完成裁切。"
      onClose={saving ? undefined : onClose}
      actions={<>
        <AdminButton variant="ghost" onClick={resetEditor} disabled={saving}>重設</AdminButton>
        <span className="adminDialogActionSpacer" />
        <AdminButton variant="ghost" onClick={onClose} disabled={saving}>取消</AdminButton>
        <AdminButton onClick={saveCrop} disabled={saving}>{saving ? '處理中…' : '套用裁切'}</AdminButton>
      </>}
    >
      <div className="adminAvatarCropWorkspace">
        <div className="adminAvatarCropCanvas">
          <AvatarEditor
            ref={editorRef}
            image={file}
            width={CROP_WIDTH}
            height={CROP_HEIGHT}
            border={[24, 30]}
            borderRadius={0}
            color={[5, 18, 32, 0.72]}
            backgroundColor="#071725"
            scale={scale}
            rotate={rotate}
            onLoadFailure={() => setError('圖片無法載入，請選擇其他圖片。')}
          />
        </div>
        <div className="adminAvatarCropControls">
          <label className="adminAvatarCropControl">
            <span>縮放</span>
            <input type="range" min="1" max="3" step="0.01" value={scale} onChange={(event) => setScale(Number(event.target.value))} disabled={saving} />
            <output>{scale.toFixed(2)}×</output>
          </label>
          <label className="adminAvatarCropControl">
            <span>旋轉</span>
            <input type="range" min="-180" max="180" step="1" value={rotate} onChange={(event) => setRotate(Number(event.target.value))} disabled={saving} />
            <output>{rotate}°</output>
          </label>
          {error ? <p className="adminAvatarCropError" role="alert">{error}</p> : null}
        </div>
      </div>
    </AdminDialog>
  );
}
