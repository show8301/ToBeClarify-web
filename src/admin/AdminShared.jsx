import { useEffect, useRef, useState } from 'react';

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

export function AdminField({ label, children, hint, className = '' }) {
  return (
    <label className={`adminField ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function AdminButton({ children, variant = 'primary', ...props }) {
  return <button className={`adminButton adminButton-${variant}`} type="button" {...props}>{children}</button>;
}

export function AdminToggle({ checked, onChange, label = '啟用' }) {
  return (
    <label className="adminToggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function AdminImagePicker({ label = '圖片', value, pendingFile, onChange, onClear, hint }) {
  const [preview, setPreview] = useState(value || '');

  useEffect(() => {
    if (!pendingFile) {
      setPreview(value || '');
      return undefined;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile, value]);

  return (
    <div className="adminImagePicker">
      <div className="adminImagePickerHeader">
        <span>{label}</span>
        {pendingFile ? <small>尚未上傳，儲存時才會送出</small> : null}
      </div>
      <div className="adminImagePreview">
        {preview ? <img src={preview} alt="預覽" /> : <span>尚無圖片</span>}
      </div>
      <div className="adminImagePickerActions">
        <label className="adminButton adminButton-secondary">
          選擇圖片
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => onChange(event.target.files?.[0] || null)} />
        </label>
        {preview ? <AdminButton variant="ghost" onClick={onClear}>清除</AdminButton> : null}
      </div>
      {hint ? <small className="adminFieldHint">{hint}</small> : null}
    </div>
  );
}

export function AdminState({ loading, error, onRetry }) {
  if (loading) return <div className="adminInlineState">載入中…</div>;
  if (error) return <div className="adminInlineState adminInlineStateError"><p>{error.message}</p><AdminButton variant="secondary" onClick={onRetry}>重新載入</AdminButton></div>;
  return null;
}

export function AdminDialog({ open, title, description, children, onClose, actions }) {
  if (!open) return null;
  return (
    <div className="adminDialogBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="adminDialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="adminDialogHeader">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <AdminButton variant="ghost" onClick={onClose} aria-label="關閉編輯視窗">關閉</AdminButton>
        </header>
        <div className="adminDialogBody">{children}</div>
        {actions ? <footer className="adminDialogFooter">{actions}</footer> : null}
      </section>
    </div>
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
            draggable={canDrag}
            onDragStart={canDrag ? (event) => { setDraggingId(id); event.dataTransfer.effectAllowed = 'move'; } : undefined}
            onDragEnd={canDrag ? () => { setDraggingId(null); setDragOverId(null); } : undefined}
            onDragOver={canDrag ? (event) => { event.preventDefault(); setDragOverId(id); } : undefined}
            onDrop={canDrag ? (event) => { event.preventDefault(); drop(id); } : undefined}
            onClick={() => { if (!draggedRef.current) onItemClick?.(item); }}
          >
            <span className={`adminDragHandle ${canDrag ? '' : 'isDisabled'}`.trim()} aria-hidden="true">{canDrag ? '⋮⋮' : '•'}</span>
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
