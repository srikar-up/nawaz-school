export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-icon">
          <Icon size={24} />
        </span>
      ) : null}
      <strong>{title}</strong>
      {message ? <p>{message}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}
