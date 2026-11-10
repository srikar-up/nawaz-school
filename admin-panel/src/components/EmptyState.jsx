export default function EmptyState({ icon: Icon, title, message, action, compact = false }) {
  return (
    <div className={`admin-empty ${compact ? 'admin-empty-compact' : ''}`}>
      {Icon ? (
        <span className="admin-empty-icon">
          <Icon size={22} />
        </span>
      ) : null}
      <strong>{title}</strong>
      {message ? <p>{message}</p> : null}
      {action ? <div className="admin-empty-action">{action}</div> : null}
    </div>
  );
}
