import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAdminImageProcessing } from '@/features/admin/media/AdminImageProcessingContext.js';
import { formatImageFileSize } from '@/features/admin/media/adminImageProcessing.js';

export function AdminPage({ eyebrow, title, description, actions, children }) {
  return (
    <section className="adminPage">
      <div className="adminPageHeading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="adminPageActions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminPanel({ title, description, actions, children, className = '' }) {
  return (
    <section className={`adminPanel ${className}`.trim()}>
      {(title || description || actions) ? (
        <header className="adminPanelHeader">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="adminPanelActions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function AdminField({ label, children, hint, className = '', required = false }) {
  return (
    <label className={`adminField ${className}`.trim()}>
      <span>{label}{required ? <b className="adminRequiredMark" aria-hidden="true">*</b> : null}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function AdminButton({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`adminButton adminButton-${variant} ${className}`.trim()} type="button" {...props}>{children}</button>;
}

export function AdminToggle({ checked, onChange, label = '啟用', ariaLabel, disabled = false, className = '' }) {
  return (
    <span className={`adminToggle ${className}`.trim()}>
      <button
        className="adminToggleSwitch"
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        aria-label={ariaLabel || label || undefined}
        disabled={disabled}
        onClick={() => onChange(!Boolean(checked))}
      />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function AdminImagePicker({ label = '圖片', value, pendingFile, onChange, onClear, hint, className = '', disabled = false, required = false }) {
  const [preview, setPreview] = useState(value || '');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState({ status: '', error: '' });
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

  const handleFile = async (file) => {
    if (!file) return;
    setProcessing(true);
    setFeedback({ status: '正在轉換並壓縮圖片…', error: '' });
    try {
      const processed = await processImage({ file, crop: false });
      onChange(processed);
      setFeedback({ status: `已轉為 WebP：${formatImageFileSize(file.size)} → ${formatImageFileSize(processed.size)}。`, error: '' });
    } catch (error) {
      setFeedback({ status: '', error: error?.message || '圖片處理失敗，請重新選擇。' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={`adminImagePicker ${className}`.trim()}>
      <div className="adminImagePickerHeader">
        <span>{label}{required ? <b className="adminRequiredMark" aria-hidden="true">*</b> : null}</span>
        {pendingFile ? <small>尚未上傳，儲存時才會送出</small> : null}
      </div>
      <div className="adminImagePreview">
        {preview ? <img src={preview} alt="預覽" /> : <span>尚無圖片</span>}
      </div>
      <div className="adminImagePickerActions">
        {!disabled ? <label className={`adminButton adminButton-secondary${processing ? ' isDisabled' : ''}`}>
          {processing ? '處理中…' : '選擇圖片'}
          <input type="file" disabled={processing} accept="image/jpeg,image/png,image/webp" onChange={(event) => { handleFile(event.target.files?.[0] || null); event.target.value = ''; }} />
        </label> : null}
        {preview && !disabled ? <AdminButton variant="ghost" disabled={processing} onClick={() => { setFeedback({ status: '', error: '' }); onClear(); }}>清除</AdminButton> : null}
      </div>
      {feedback.status ? <small className="adminFieldHint" role="status">{feedback.status}</small> : null}
      {feedback.error ? <small className="adminImageProcessorError" role="alert">{feedback.error}</small> : null}
      {hint ? <small className="adminFieldHint">{hint}</small> : null}
    </div>
  );
}

export function AdminState({ loading, error, onRetry }) {
  if (loading) return <div className="adminInlineState">載入中…</div>;
  if (error) return <div className="adminInlineState adminInlineStateError"><p>{error.message}</p><AdminButton variant="secondary" onClick={onRetry}>重新載入</AdminButton></div>;
  return null;
}

export function AdminDialog({ open, title, description, children, onClose, actions, className = '', showHeader = true }) {
  const reduceMotion = useReducedMotion();
  const popupClassName = `adminDialogPopup${className.includes('adminStaffEditDialog') ? ' adminStaffEditDialogPopup' : ''}`;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal keepMounted>
            <div className="adminTheme adminDialogPortalTheme">
              <Dialog.Backdrop
                render={<motion.div className="adminDialogBackdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.2 }} />}
              />
              <Dialog.Popup
                className={popupClassName}
                render={(
                  <div>
                    <motion.section
                      className={`adminDialog ${className}`.trim()}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.975 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
                      transition={reduceMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 310, damping: 30 }}
                    >
                      {showHeader ? <header className="adminDialogHeader">
                        <div>
                          <Dialog.Title className="adminDialogTitle">{title}</Dialog.Title>
                          {description ? <Dialog.Description className="adminDialogDescription">{description}</Dialog.Description> : null}
                        </div>
                        <Dialog.Close className="adminButton adminButton-ghost" aria-label="關閉編輯視窗">關閉</Dialog.Close>
                      </header> : <><Dialog.Title className="adminVisuallyHidden">{title}</Dialog.Title>{description ? <Dialog.Description className="adminVisuallyHidden">{description}</Dialog.Description> : null}</>}
                      <div className="adminDialogBody">{children}</div>
                      {actions ? <footer className="adminDialogFooter">{actions}</footer> : null}
                    </motion.section>
                  </div>
                )}
              />
            </div>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function AdminDragList({ items, onReorder, onItemClick, renderItem, emptyText = '尚無資料。', canDrag = true }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const draggedRef = useRef(false);
  const getId = (item) => item.id;

  const drop = (targetId) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const sourceIndex = items.findIndex((item) => getId(item) === draggingId);
    const targetIndex = items.findIndex((item) => getId(item) === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    draggedRef.current = true;
    onReorder(next.map((item, index) => ({ ...item, sortOrder: index })));
    setDraggingId(null);
    setDragOverId(null);
    window.setTimeout(() => { draggedRef.current = false; }, 0);
  };

  return (
    <div className="adminDragList">
      {items.map((item) => {
        const id = getId(item);
        return (
          <article
            className={`adminDragCard ${draggingId === id ? 'isDragging' : ''} ${dragOverId === id ? 'isDragOver' : ''}`.trim()}
            key={id}
            onDragOver={canDrag ? (event) => { if (!draggingId) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOverId(id); } : undefined}
            onDrop={canDrag ? (event) => { event.preventDefault(); drop(id); } : undefined}
            onClick={() => { if (!draggedRef.current) onItemClick?.(item); }}
          >
            <span
              className={`adminDragHandle ${canDrag ? '' : 'isDisabled'}`.trim()}
              draggable={canDrag}
              aria-hidden="true"
              onDragStart={canDrag ? (event) => {
                draggedRef.current = true;
                setDraggingId(id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', id);
              } : undefined}
              onDragEnd={canDrag ? () => {
                setDraggingId(null);
                setDragOverId(null);
                window.setTimeout(() => { draggedRef.current = false; }, 0);
              } : undefined}
            >
              {canDrag ? '⋮⋮' : '•'}
            </span>
            <div className="adminDragCardContent">{renderItem(item)}</div>
          </article>
        );
      })}
      {!items.length ? <p className="adminEmptyText">{emptyText}</p> : null}
    </div>
  );
}

export function newId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function splitParagraphs(value) {
  return String(value || '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
}

export function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value) {
  // Admin API stores business times as Taiwan-local DATETIME values, not UTC instants.
  return value || new Date().toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16);
}
