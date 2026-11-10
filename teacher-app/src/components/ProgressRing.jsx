export default function ProgressRing({
  value = 0,
  size = 96,
  stroke = 9,
  color = 'var(--brand)',
  track = 'var(--brand-100)',
  children,
  className = '',
  label,
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div
      className={`progress-ring ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `${Math.round(safeValue)} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .5s ease' }}
        />
      </svg>
      <div className="progress-ring-content">{children}</div>
    </div>
  );
}
