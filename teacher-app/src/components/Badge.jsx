export default function Badge({ tone = 'neutral', children, icon: Icon, className = '' }) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {Icon ? <Icon size={12} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}
