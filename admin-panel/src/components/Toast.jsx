import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const Icon = ICONS[toast.type] || Info;
  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <span className="toast-icon">
        <Icon size={18} />
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss message">
        <X size={16} />
      </button>
    </div>
  );
}
