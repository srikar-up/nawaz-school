import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Drawer({ open = true, title, subtitle, onClose, children, footer, width = 480 }) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event) => event.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="drawer-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <aside
        className="drawer-panel"
        style={{ '--drawer-width': `${width}px` }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Details'}
      >
        <div className="drawer-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            <X size={19} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-footer">{footer}</div> : null}
      </aside>
    </div>,
    document.body
  );
}
