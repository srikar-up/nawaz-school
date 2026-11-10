import { useId } from 'react';

function niceMax(value) {
  if (value <= 10) return 10;
  if (value <= 100) return Math.ceil(value / 10) * 10;
  return Math.ceil(value / 50) * 50;
}

export function GroupedBarChart({
  data = [],
  series = [],
  height = 240,
  maxValue,
  formatValue = (value) => value,
  ariaLabel = 'Bar chart',
}) {
  const width = 760;
  const padding = { top: 18, right: 12, bottom: 34, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = data.flatMap((item) =>
    series.map((entry) => Number(item[entry.key]) || 0)
  );
  const max = maxValue || niceMax(Math.max(1, ...values));
  const groupWidth = data.length ? plotWidth / data.length : plotWidth;
  const barGap = 5;
  const barWidth = Math.min(
    24,
    Math.max(6, (groupWidth * 0.56 - barGap * (series.length - 1)) / series.length)
  );
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="chart-block">
      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart-svg"
          role="img"
          aria-label={ariaLabel}
        >
          {ticks.map((tick) => {
            const value = max * tick;
            const y = padding.top + plotHeight - tick * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#eef2f7"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {formatValue(Math.round(value))}
                </text>
              </g>
            );
          })}
          {data.map((item, groupIndex) => {
            const groupX = padding.left + groupIndex * groupWidth;
            const totalWidth = series.length * barWidth + (series.length - 1) * barGap;
            const startX = groupX + groupWidth / 2 - totalWidth / 2;
            return (
              <g key={item.label}>
                {series.map((entry, seriesIndex) => {
                  const value = Number(item[entry.key]) || 0;
                  const barHeight = (value / max) * plotHeight;
                  const x = startX + seriesIndex * (barWidth + barGap);
                  const y = padding.top + plotHeight - barHeight;
                  return (
                    <rect
                      key={entry.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(0, barHeight)}
                      rx="4"
                      fill={entry.color}
                      opacity={entry.opacity || 1}
                    >
                      <title>{`${item.label} · ${entry.label}: ${value}`}</title>
                    </rect>
                  );
                })}
                <text
                  x={groupX + groupWidth / 2}
                  y={height - 12}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {series.length ? (
        <div className="chart-legend">
          {series.map((entry) => (
            <span key={entry.key}>
              <i style={{ background: entry.color }} /> {entry.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LineChart({
  data = [],
  height = 230,
  color = '#4338CA',
  maxValue = 100,
  suffix = '%',
  ariaLabel = 'Line chart',
}) {
  const gradientId = useId().replace(/:/g, '');
  const width = 760;
  const padding = { top: 18, right: 16, bottom: 30, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = maxValue || Math.max(1, ...data.map((entry) => entry.value));
  const points = data.map((entry, index) => {
    const x = padding.left + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - (Number(entry.value) / max) * plotHeight;
    return { ...entry, x, y };
  });

  let linePath = '';
  if (points.length) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const midX = (previous.x + current.x) / 2;
      linePath += ` C ${midX} ${previous.y}, ${midX} ${current.y}, ${current.x} ${current.y}`;
    }
  }
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + plotHeight} L ${points[0].x} ${padding.top + plotHeight} Z`
    : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="chart-block">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - tick * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#eef2f7"
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={y + 3} textAnchor="end" className="chart-axis-label">
                {Math.round(max * tick)}{suffix}
              </text>
            </g>
          );
        })}
        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((point, index) => (
          <g key={point.label || index}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5">
              <title>{`${point.label}: ${point.value}${suffix}`}</title>
            </circle>
            {data.length <= 10 || index % 2 === 0 ? (
              <text
                x={point.x}
                y={height - 8}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function DonutChart({
  data = [],
  size = 190,
  thickness = 26,
  centerValue,
  centerLabel,
  ariaLabel = 'Donut chart',
}) {
  const total = data.reduce((sum, entry) => sum + Number(entry.value || 0), 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={thickness}
        />
        {data.map((entry) => {
          const value = Number(entry.value || 0);
          const length = (value / total) * circumference;
          const gap = 3;
          const dash = Math.max(0, length - gap);
          const currentOffset = offset;
          offset += length;
          return (
            <circle
              key={entry.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={entry.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-currentOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            >
              <title>{`${entry.label}: ${value}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="donut-center">
        <strong>{centerValue}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}

export function Sparkline({ values = [], color = '#4338CA', width = 92, height = 30 }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
