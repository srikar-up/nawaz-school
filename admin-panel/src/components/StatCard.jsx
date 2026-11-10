import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Sparkline } from './Charts';

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'lavender',
  trend,
  trendDirection = 'up',
  hint,
  sparkline,
  sparkColor,
}) {
  const TrendIcon = trendDirection === 'down' ? ArrowDownRight : ArrowUpRight;
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-icon">{Icon ? <Icon size={19} /> : null}</span>
        <span className="stat-card-dots" aria-hidden="true">
          ···
        </span>
      </div>
      <div className="stat-card-main">
        <div>
          <span className="stat-label">{label}</span>
          <strong className={`stat-value ${String(value).length > 8 ? 'stat-value-small' : ''}`}>
            {value}
          </strong>
        </div>
        {sparkline?.length ? (
          <span className="stat-spark">
            <Sparkline values={sparkline} color={sparkColor || 'rgba(30,41,59,.45)'} />
          </span>
        ) : null}
      </div>
      <div className="stat-card-foot">
        {trend ? (
          <span className={`stat-trend ${trendDirection}`}>
            <TrendIcon size={12} /> {trend}
          </span>
        ) : null}
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </div>
    </article>
  );
}
