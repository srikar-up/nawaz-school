import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({
  open = true,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  footer,
  size = 'md',
}) {
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
      className="modal-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <div className={`modal-card modal-${size}`} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
        <div className="modal-head">
          <div className="modal-head-main">
            {Icon ? (
              <span className="modal-icon">
                <Icon size={20} />
              </span>
            ) : null}
            <div>
              {title ? <h2>{title}</h2> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
