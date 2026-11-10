import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Sheet({
  open = true,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'normal',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`sheet sheet-${size}`} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
