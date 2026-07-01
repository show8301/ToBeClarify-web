import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('modalOpen');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('modalOpen');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="modalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modalPanel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="closeButton" type="button" aria-label="關閉視窗" onClick={onClose}>
          ×
        </button>
        {children}
      </section>
    </div>,
    document.body,
  );
}
