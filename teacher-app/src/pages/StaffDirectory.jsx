import { useMemo, useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  ClipboardCheck,
  Mail,
  Phone,
  Search,
  UsersRound,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import { categoryLabel, classLabel, examEffectiveStatus } from '../lib/format';

const FILTERS = [
  { value: 'all', label: 'Everyone' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'office', label: 'Office & support' },
];

function isTeacher(member) {
  return member.staffType === 'Teacher' || member.accessLevel === 'TeacherApp';
}

function phoneHref(phone) {
  return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
}

export default function StaffDirectory() {
  const { data, user } = useAppData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const activeStaff = useMemo(
    () => data.staff.filter((member) => member.isActive),
    [data.staff]
  );
  const teachers = activeStaff.filter(isTeacher);
  const officeStaff = activeStaff.filter((member) => !isTeacher(member));

  const assignments = useMemo(() => {
    const map = new Map();
    activeStaff.forEach((member) => {
      const subjects = data.subjects.filter(
        (subject) => subject.assignedStaffId === member.id
      );
      const classIds = new Set(subjects.map((subject) => subject.classIdSection));
      data.classIncharges
        .filter((entry) => entry.activeStaffId === member.id)
        .forEach((entry) => classIds.add(entry.classIdSection));
      const examOrder = { Open: 0, Upcoming: 1, Submitted: 2, Locked: 3 };
      const exams = data.exams
        .filter((exam) => exam.assignedStaffId === member.id)
        .sort((a, b) => {
          const statusDiff =
            (examOrder[examEffectiveStatus(a)] ?? 4) -
            (examOrder[examEffectiveStatus(b)] ?? 4);
          if (statusDiff !== 0) return statusDiff;
          return new Date(a.date) - new Date(b.date);
        });
      map.set(member.id, {
        subjects,
        classes: data.classes.filter((cls) => classIds.has(cls.id)),
        exams,
        nextExam: exams[0] || null,
      });
    });
    return map;
  }, [activeStaff, data.classIncharges, data.classes, data.exams, data.subjects]);

  const visibleStaff = useMemo(() => {
    const text = search.trim().toLowerCase();
    return activeStaff
      .filter((member) => {
        const matchesFilter =
          filter === 'all' ||
          (filter === 'teachers' && isTeacher(member)) ||
          (filter === 'office' && !isTeacher(member));
        const matchesSearch =
          !text ||
          member.name.toLowerCase().includes(text) ||
          member.department.toLowerCase().includes(text) ||
          member.staffType.toLowerCase().includes(text) ||
          member.email.toLowerCase().includes(text);
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        if (a.id === user.id && b.id !== user.id) return -1;
        if (b.id === user.id && a.id !== user.id) return 1;
        const teacherDiff = Number(isTeacher(b)) - Number(isTeacher(a));
        if (teacherDiff !== 0) return teacherDiff;
        return a.name.localeCompare(b.name);
      });
  }, [activeStaff, filter, search, user.id]);

  return (
    <div className="t-page">
      <PageHead
        backTo="/more"
        eyebrow="People & faculty"
        title="School directory"
        subtitle="Find a colleague, check teaching loads and get in touch."
      />

      <section className="directory-hero">
        <span className="directory-hero-icon">
          <UsersRound size={23} />
        </span>
        <div>
          <span className="eyebrow">This academic year</span>
          <h2>{teachers.length} teaching faculty, {officeStaff.length} office &amp; support</h2>
          <p>
            Every active member of {data.meta.schoolName}. Classes and assessment duties are
            read-only for colleagues.
          </p>
        </div>
      </section>

      <div className="search-input directory-search">
        <Search size={17} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, department or role"
          aria-label="Search the school directory"
        />
      </div>

      <div className="filter-pills" role="tablist" aria-label="Filter staff">
        {FILTERS.map((entry) => {
          const count =
            entry.value === 'teachers'
              ? teachers.length
              : entry.value === 'office'
                ? officeStaff.length
                : activeStaff.length;
          return (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={filter === entry.value}
              className={filter === entry.value ? 'active' : ''}
              onClick={() => setFilter(entry.value)}
            >
              {entry.label} <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="staff-list">
        {visibleStaff.map((member) => {
          const load = assignments.get(member.id) || {
            subjects: [],
            classes: [],
            exams: [],
            nextExam: null,
          };
          const isMe = member.id === user.id;
          return (
            <article key={member.id} className={`staff-card ${isMe ? 'staff-card-me' : ''}`}>
              <div className="staff-card-head">
                <Avatar name={member.name} size={44} />
                <div>
                  <h3>
                    {member.name}
                    {isMe ? <Badge tone="brand">You</Badge> : null}
                  </h3>
                  <p>
                    {member.staffType} · {member.department}
                  </p>
                </div>
              </div>

              <div className="staff-card-meta">
                {isTeacher(member) ? (
                  <>
                    <span>
                      <BookOpen size={12} /> {load.subjects.length} subject
                      {load.subjects.length === 1 ? '' : 's'}
                    </span>
                    <span>
                      <UsersRound size={12} /> {load.classes.length} class
                      {load.classes.length === 1 ? '' : 'es'}
                    </span>
                    <span>
                      <ClipboardCheck size={12} /> {load.exams.length} assessment
                      {load.exams.length === 1 ? '' : 's'}
                    </span>
                  </>
                ) : (
                  <span>
                    <BriefcaseBusiness size={12} /> {member.department}
                  </span>
                )}
              </div>

              {isTeacher(member) && load.classes.length ? (
                <div className="staff-class-chips">
                  {load.classes.slice(0, 4).map((cls) => (
                    <span key={cls.id}>{classLabel(data, cls.id)}</span>
                  ))}
                  {load.classes.length > 4 ? (
                    <span>+{load.classes.length - 4} more</span>
                  ) : null}
                </div>
              ) : null}

              {isTeacher(member) && load.nextExam ? (
                <div className="staff-exam-line">
                  <ClipboardCheck size={13} />
                  <span>
                    Assessment duty: <strong>{load.nextExam.title}</strong>{' '}
                    {categoryLabel(load.nextExam.category)} ·{' '}
                    {examEffectiveStatus(load.nextExam)}
                    {load.exams.length > 1 ? ` · ${load.exams.length} total` : ''}
                  </span>
                </div>
              ) : null}

              <div className="staff-card-actions">
                <a href={`mailto:${member.email}`} className="btn btn-secondary btn-sm">
                  <Mail size={14} /> Email
                </a>
                {member.phone ? (
                  <a href={phoneHref(member.phone)} className="btn btn-ghost btn-sm">
                    <Phone size={14} /> {member.phone}
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {!visibleStaff.length ? (
        <EmptyState
          icon={UsersRound}
          title="No colleagues match this search"
          message="Try another name, department or role."
        />
      ) : null}
    </div>
  );
}
