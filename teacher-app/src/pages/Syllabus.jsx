import { useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  CircleDashed,
  Clock3,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import ProgressRing from '../components/ProgressRing';
import { classLabel, getSubjectsForTeacher, relativeTime } from '../lib/format';

const STATUS_META = {
  completed: { label: 'Completed', tone: 'success', icon: Check },
  in_progress: { label: 'In progress', tone: 'warning', icon: Clock3 },
  pending: { label: 'Not started', tone: 'neutral', icon: Circle },
};

function nextStatus(status) {
  if (status === 'completed') return 'pending';
  if (status === 'in_progress') return 'completed';
  return 'in_progress';
}

export default function Syllabus() {
  const { data, user, notify, refresh } = useAppData();
  const subjects = getSubjectsForTeacher(data, user.id);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [busyIndex, setBusyIndex] = useState(null);
  const subject = subjects.find((entry) => entry.id === subjectId) || subjects[0];

  if (!subjects.length) {
    return (
      <div className="t-page">
        <PageHead backTo="/more" eyebrow="Curriculum" title="Syllabus" />
        <EmptyState
          icon={BookOpen}
          title="No subject assigned"
          message="Ask the academic office to assign a subject before tracking its syllabus."
        />
      </div>
    );
  }

  const completed = subject.chapters.filter((chapter) => chapter.status === 'completed').length;
  const inProgress = subject.chapters.filter((chapter) => chapter.status === 'in_progress').length;
  const pending = subject.chapters.length - completed - inProgress;
  const percentage = Math.round((completed / subject.chapters.length) * 100);

  const cycle = async (chapterIndex) => {
    const chapter = subject.chapters[chapterIndex];
    setBusyIndex(chapterIndex);
    try {
      await api.updateChapter(user.id, subject.id, chapterIndex, nextStatus(chapter.status));
      await refresh({ silent: true });
      notify(
        `${chapter.title} marked as ${STATUS_META[nextStatus(chapter.status)].label.toLowerCase()}.`,
        'success'
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusyIndex(null);
    }
  };

  return (
    <div className="t-page">
      <PageHead
        backTo="/more"
        eyebrow="Curriculum tracker"
        title="Syllabus"
        subtitle="Tap a chapter to move it through progress states."
      />

      <div className="class-pills syllabus-pills" role="tablist" aria-label="Choose subject">
        {subjects.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === subject.id}
            className={`class-pill ${entry.id === subject.id ? 'active' : ''}`}
            onClick={() => setSubjectId(entry.id)}
          >
            {entry.subjectName} <span>{entry.classIdSection}</span>
          </button>
        ))}
      </div>

      <section className="syllabus-hero">
        <ProgressRing
          value={percentage}
          size={118}
          stroke={11}
          color="var(--brand)"
          track="rgba(255,255,255,.2)"
        >
          <strong>{percentage}%</strong>
          <span>complete</span>
        </ProgressRing>
        <div className="syllabus-hero-text">
          <span className="eyebrow">{classLabel(data, subject.classIdSection)}</span>
          <h2>{subject.subjectName}</h2>
          <p>
            {subject.subjectCode} · {subject.chapters.length} chapters · updated{' '}
            {relativeTime(subject.updatedAt)}
          </p>
          <div className="syllabus-counts">
            <span>
              <strong>{completed}</strong> done
            </span>
            <span>
              <strong>{inProgress}</strong> in progress
            </span>
            <span>
              <strong>{pending}</strong> left
            </span>
          </div>
        </div>
      </section>

      <div className="syllabus-legend">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span key={key}>
            <i className={`legend-dot ${meta.tone}`} /> {meta.label}
          </span>
        ))}
      </div>

      <div className="chapter-list">
        {subject.chapters.map((chapter, index) => {
          const meta = STATUS_META[chapter.status] || STATUS_META.pending;
          const Icon = meta.icon;
          return (
            <button
              key={`${chapter.title}-${index}`}
              type="button"
              className={`chapter-row chapter-${chapter.status}`}
              onClick={() => cycle(index)}
              disabled={busyIndex !== null}
            >
              <span className="chapter-number">{index + 1}</span>
              <span className="chapter-text">
                <strong>{chapter.title}</strong>
                <small>Tap to mark {STATUS_META[nextStatus(chapter.status)].label.toLowerCase()}</small>
              </span>
              {busyIndex === index ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <Badge tone={meta.tone} icon={Icon}>
                  {meta.label}
                </Badge>
              )}
              <ChevronRight size={16} className="chapter-chevron" />
            </button>
          );
        })}
      </div>

      <div className="info-strip neutral">
        <GraduationCap size={17} />
        <span>
          Chapter progress is shared with the admin curriculum view. Completed chapters are
          included in the school’s syllabus delivery report.
        </span>
      </div>
    </div>
  );
}
