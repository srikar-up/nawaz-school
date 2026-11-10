export default function PageHeader({ eyebrow, title, subtitle, actions, children }) {
  return (
    <header className="admin-page-head">
      <div className="admin-page-head-text">
        {eyebrow ? <span className="admin-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}
