export default function Badge({ tone = 'neutral', children, icon: Icon, dot = false, className = '' }) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {dot ? <span className={`badge-dot ${tone}`} /> : null}
      {Icon ? <Icon size={12} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}
