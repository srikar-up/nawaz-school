import { useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Megaphone,
  Pin,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import {
  formatDate,
  priorityTone,
  relativeTime,
} from '../lib/format';

const FILTERS = ['All', 'Normal', 'Important', 'Urgent', 'Emergency'];

export default function Notices() {
  const { data } = useAppData();
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const notices = [...data.announcements].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const counts = Object.fromEntries(
    FILTERS.map((entry) => [
      entry,
      entry === 'All'
        ? notices.length
        : notices.filter((notice) => notice.importance === entry).length,
    ])
  );
  const visible = notices.filter(
    (notice) => filter === 'All' || notice.importance === filter
  );
  const priorityNotices = visible.filter(
    (notice) =>
      notice.isPinned ||
      notice.importance === 'Urgent' ||
      notice.importance === 'Emergency'
  );
  const regularNotices = visible.filter(
    (notice) => !priorityNotices.some((priority) => priority.id === notice.id)
  );
  const emergency = notices.find((notice) => notice.importance === 'Emergency');

  const renderNotice = (notice) => {
    const expanded = expandedId === notice.id;
    const tone = priorityTone(notice.importance);
    return (
      <article
        key={notice.id}
        className={`notice-feed-card notice-tone-${tone} ${expanded ? 'expanded' : ''}`}
      >
        <button
          type="button"
          className="notice-feed-button"
          onClick={() => setExpandedId(expanded ? null : notice.id)}
          aria-expanded={expanded}
        >
          <div className="notice-feed-top">
            <div className="notice-feed-badges">
              <Badge tone={tone}>{notice.importance}</Badge>
              {notice.isPinned ? (
                <Badge tone="neutral" icon={Pin}>
                  Pinned
                </Badge>
              ) : null}
            </div>
            <span className="notice-time">{relativeTime(notice.createdAt)}</span>
          </div>
          <h3>{notice.title}</h3>
          <p className={expanded ? '' : 'clamped'}>{notice.body}</p>
          <div className="notice-feed-foot">
            <span>
              <Users size={13} /> {notice.audience}
            </span>
            <span>
              <CalendarDays size={13} /> {formatDate(notice.createdAt.slice(0, 10))}
            </span>
            <span className="notice-expand">
              {expanded ? (
                <>
                  Less <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Read more <ChevronDown size={14} />
                </>
              )}
            </span>
          </div>
        </button>
        <div className="notice-publisher">Published by {notice.publisherName}</div>
      </article>
    );
  };

  return (
    <div className="t-page">
      <PageHead
        backTo="/more"
        eyebrow="School broadcast"
        title="Notices"
        subtitle="Announcements from the principal and school office, in one calm feed."
        action={<Badge tone="brand" icon={Megaphone}>{notices.length}</Badge>}
      />

      {emergency ? (
        <div className="emergency-banner">
          <span className="emergency-icon">
            <Megaphone size={19} />
          </span>
          <div>
            <strong>{emergency.title}</strong>
            <span>{relativeTime(emergency.createdAt)} · {emergency.publisherName}</span>
          </div>
        </div>
      ) : null}

      <div className="filter-pills notice-filters">
        {FILTERS.map((entry) => (
          <button
            key={entry}
            type="button"
            className={filter === entry ? 'active' : ''}
            onClick={() => setFilter(entry)}
          >
            {entry} <span>{counts[entry]}</span>
          </button>
        ))}
      </div>

      {priorityNotices.length ? (
        <section className="section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Priority</span>
              <h2>Needs your attention</h2>
            </div>
            <Sparkles size={18} className="muted-icon" />
          </div>
          <div className="notice-feed">{priorityNotices.map(renderNotice)}</div>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Feed</span>
            <h2>{priorityNotices.length ? 'All updates' : 'Updates'}</h2>
          </div>
        </div>
        {regularNotices.length ? (
          <div className="notice-feed">{regularNotices.map(renderNotice)}</div>
        ) : priorityNotices.length ? null : (
          <EmptyState
            icon={Megaphone}
            title="No notices here"
            message="Try another filter. New school announcements will appear automatically."
          />
        )}
      </section>
    </div>
  );
}
