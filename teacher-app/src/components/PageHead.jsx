import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PageHead({ backTo, eyebrow, title, subtitle, action, compact = false }) {
  return (
    <header className={`page-head ${compact ? 'page-head-compact' : ''}`}>
      <div className="page-head-row">
        {backTo ? (
          <Link to={backTo} className="icon-btn page-back" aria-label="Go back">
            <ArrowLeft size={20} />
          </Link>
        ) : null}
        <div className="page-head-text">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="page-head-action">{action}</div> : null}
      </div>
    </header>
  );
}
