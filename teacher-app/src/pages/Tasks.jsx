import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FilePlus2,
  ListChecks,
  LockKeyhole,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import Sheet from '../components/Sheet';
import {
  addDaysISO,
  categoryLabel,
  classLabel,
  examEffectiveStatus,
  formatDate,
  formatTime,
  getTeacherClasses,
  relativeTime,
  todayISO,
} from '../lib/format';

const EXAM_TONE = {
  Open: 'success',
  Upcoming: 'warning',
  Submitted: 'neutral',
  Locked: 'danger',
};

function ExamCard({ exam, data, user }) {
  const status = examEffectiveStatus(exam);
  const isMine = exam.assignedStaffId === user.id;
  const assignedTeacher = data.staff.find(
    (member) => member.id === exam.assignedStaffId
  );
  const records = data.testRecords.filter((record) => record.examId === exam.id);
  const average = records.length
    ? Math.round(
        (records.reduce((sum, record) => sum + record.percentage, 0) / records.length) * 10
      ) / 10
    : null;
  return (
    <article className={`exam-card exam-${status.toLowerCase()} ${isMine ? 'exam-mine' : ''}`}>
      <div className="exam-card-top">
        <div className="exam-badges">
          <Badge tone="brand">{categoryLabel(exam.category)}</Badge>
          <Badge tone={EXAM_TONE[status] || 'neutral'}>{status}</Badge>
        </div>
        <span className="exam-date">{formatDate(exam.date)}</span>
      </div>
      <h3>{exam.title}</h3>
      <div className="exam-meta">
        <span>
          <BookOpen size={13} /> {exam.subject} · {classLabel(data, exam.classIdSection)}
        </span>
        <span>
          <Clock3 size={13} /> {formatTime(exam.startTime)} – {formatTime(exam.endTime)}
        </span>
        <span>Max {exam.maxMarks} marks</span>
      </div>

      <div className="exam-assignee">
        <Avatar name={assignedTeacher?.name || 'Unassigned'} size={27} photo={assignedTeacher?.photo} />
        <span>
          Assigned to{' '}
          <strong>{isMine ? 'you' : assignedTeacher?.name || 'Unassigned'}</strong>
        </span>
        <Badge tone={isMine ? 'brand' : 'neutral'}>{isMine ? 'Your exam' : 'Read-only'}</Badge>
      </div>

      {status === 'Submitted' ? (
        <div className="exam-result-strip">
          <span>
            <CheckCircle2 size={15} /> Marks submitted
          </span>
          <strong>{average !== null ? `${average}% class average` : 'No scores'}</strong>
        </div>
      ) : null}
      {status === 'Open' && isMine ? (
        <Link to={`/tasks/exams/${exam.id}`} className="btn btn-primary btn-block">
          <ClipboardList size={16} /> Enter marks
          <ArrowRight size={16} />
        </Link>
      ) : status === 'Submitted' ? (
        <Link to={`/tasks/exams/${exam.id}`} className="btn btn-secondary btn-block">
          View submitted scores
        </Link>
      ) : status === 'Open' ? (
        <div className="exam-locked">
          <LockKeyhole size={15} /> Marks entry is with {assignedTeacher?.name || 'the assigned teacher'}
        </div>
      ) : (
        <div className="exam-locked">
          <Clock3 size={15} /> Opens automatically after the exam ends
        </div>
      )}
    </article>
  );
}

function AssignmentCard({ assignment, data, user, onReview, onDelete, busy }) {
  const createdByMe = assignment.createdByStaffId === user.id;
  const creator = data.staff.find((member) => member.id === assignment.createdByStaffId);
  const overdue = assignment.status !== 'Reviewed' && assignment.dueDate < todayISO();
  return (
    <article className="assignment-card">
      <div className="assignment-top">
        <Badge tone={assignment.status === 'Reviewed' ? 'success' : overdue ? 'danger' : 'brand'}>
          {assignment.status === 'Reviewed' ? 'Reviewed' : overdue ? 'Overdue' : 'Assigned'}
        </Badge>
        <span className="exam-date">
          <CalendarDays size={13} /> Due {formatDate(assignment.dueDate)}
        </span>
      </div>
      <h3>{assignment.title}</h3>
      <p className="assignment-description">{assignment.description}</p>
      <div className="assignment-meta">
        <span>{assignment.subject}</span>
        <span>{classLabel(data, assignment.classIdSection)}</span>
        <span>By {creator?.name || 'School office'}</span>
      </div>
      {createdByMe ? (
        <div className="assignment-actions">
          {assignment.status !== 'Reviewed' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onReview(assignment)}
              disabled={busy}
            >
              <ListChecks size={15} /> Mark reviewed
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm danger-text"
            onClick={() => onDelete(assignment)}
            disabled={busy}
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function Tasks() {
  const { data, user, notify, refresh } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'assignments' ? 'assignments' : 'exams');
  const [examScope, setExamScope] = useState(
    searchParams.get('scope') === 'mine' ? 'mine' : 'all'
  );
  const [composeOpen, setComposeOpen] = useState(searchParams.get('compose') === 'assignment');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    classIdSection: '',
    subject: '',
    dueDate: addDaysISO(todayISO(), 7),
    description: '',
  });

  const classes = getTeacherClasses(data, user.id);
  const teacherClassIds = new Set(classes.map((cls) => cls.id));
  const myExams = data.exams.filter((exam) => exam.assignedStaffId === user.id);
  const exams = (examScope === 'mine' ? myExams : data.exams)
    .slice()
    .sort((a, b) => {
      const order = { Open: 0, Upcoming: 1, Submitted: 2, Locked: 3 };
      const statusDiff =
        (order[examEffectiveStatus(a)] ?? 4) - (order[examEffectiveStatus(b)] ?? 4);
      if (statusDiff !== 0) return statusDiff;
      const mineDiff =
        Number(b.assignedStaffId === user.id) - Number(a.assignedStaffId === user.id);
      if (mineDiff !== 0) return mineDiff;
      return new Date(`${b.date}T12:00:00`) - new Date(`${a.date}T12:00:00`);
    });
  const assignments = data.assignments
    .filter((assignment) => teacherClassIds.has(assignment.classIdSection))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Reviewed' ? 1 : -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  const openExams = myExams.filter((exam) => examEffectiveStatus(exam) === 'Open');
  const subjectsForClass = data.subjects.filter(
    (subject) => subject.classIdSection === form.classIdSection
  );

  useEffect(() => {
    if (searchParams.get('compose') === 'assignment') setComposeOpen(true);
    if (searchParams.get('tab') === 'assignments') setTab('assignments');
  }, [searchParams]);

  const openCompose = () => {
    setForm({
      title: '',
      classIdSection: classes[0]?.id || '',
      subject: '',
      dueDate: addDaysISO(todayISO(), 7),
      description: '',
    });
    setComposeOpen(true);
  };

  const createAssignment = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createAssignment(user.id, {
        ...form,
        classIdSection: form.classIdSection || classes[0]?.id,
      });
      await refresh({ silent: true });
      setComposeOpen(false);
      setTab('assignments');
      setSearchParams({ tab: 'assignments' }, { replace: true });
      notify('Assignment created for your class.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = async (assignment) => {
    setBusy(true);
    try {
      await api.updateAssignment(user.id, assignment.id, { status: 'Reviewed' });
      await refresh({ silent: true });
      notify('Assignment marked as reviewed.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteAssignment = async (assignment) => {
    setBusy(true);
    try {
      await api.deleteAssignment(user.id, assignment.id);
      await refresh({ silent: true });
      notify('Assignment removed.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="t-page">
      <PageHead
        eyebrow="Assessments & classwork"
        title="Tasks"
        subtitle="Enter marks, set assignments and keep track of what is due."
        action={
          <button type="button" className="icon-btn" onClick={openCompose} aria-label="New assignment">
            <Plus size={20} />
          </button>
        }
      />

      <div className="segmented segmented-2 tasks-tabs">
        <button
          type="button"
          className={tab === 'exams' ? 'active' : ''}
          onClick={() => {
            setTab('exams');
            setSearchParams(
              { tab: 'exams', ...(examScope === 'mine' ? { scope: 'mine' } : {}) },
              { replace: true }
            );
          }}
        >
          Exams <span className="tab-count">{data.exams.length}</span>
        </button>
        <button
          type="button"
          className={tab === 'assignments' ? 'active' : ''}
          onClick={() => {
            setTab('assignments');
            setSearchParams({ tab: 'assignments' }, { replace: true });
          }}
        >
          Assignments <span className="tab-count">{assignments.length}</span>
        </button>
      </div>

      {tab === 'exams' ? (
        <>
          <div className="filter-pills exam-scope" role="tablist" aria-label="Exam scope">
            <button
              type="button"
              role="tab"
              aria-selected={examScope === 'all'}
              className={examScope === 'all' ? 'active' : ''}
              onClick={() => {
                setExamScope('all');
                setSearchParams({ tab: 'exams' }, { replace: true });
              }}
            >
              All school exams <span>{data.exams.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={examScope === 'mine'}
              className={examScope === 'mine' ? 'active' : ''}
              onClick={() => {
                setExamScope('mine');
                setSearchParams({ tab: 'exams', scope: 'mine' }, { replace: true });
              }}
            >
              Assigned to me <span>{myExams.length}</span>
            </button>
          </div>

          {openExams.length ? (
            <div className="info-strip">
              <Sparkles size={17} />
              <span>
                <strong>{openExams.length} exam{openExams.length > 1 ? 's' : ''} waiting</strong> for
                your marks. Entry closes when an administrator submits the result.
              </span>
            </div>
          ) : null}

          {examScope === 'all' ? (
            <div className="info-strip neutral">
              <LockKeyhole size={17} />
              <span>
                <strong>Only the assigned teacher can enter marks.</strong> Colleagues' exams are
                visible here read-only, so you always know what is happening across the school.
              </span>
            </div>
          ) : null}

          <div className="exam-list">
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} data={data} user={user} />
            ))}
            {!exams.length ? (
              <EmptyState
                icon={ClipboardList}
                title={examScope === 'mine' ? 'No exams assigned' : 'No exams scheduled'}
                message={
                  examScope === 'mine'
                    ? 'When the office assigns an assessment to you, it will appear here after the exam concludes.'
                    : 'School-wide assessments will appear here as soon as the office schedules them.'
                }
              />
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="tasks-toolbar">
            <span>
              {assignments.filter((assignment) => assignment.status !== 'Reviewed').length} open ·{' '}
              {assignments.filter((assignment) => assignment.status === 'Reviewed').length} reviewed
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={openCompose}>
              <Plus size={15} /> New assignment
            </button>
          </div>
          <div className="assignment-list">
            {assignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                data={data}
                user={user}
                onReview={markReviewed}
                onDelete={deleteAssignment}
                busy={busy}
              />
            ))}
            {!assignments.length ? (
              <EmptyState
                icon={FilePlus2}
                title="No assignments yet"
                message="Create your first class assignment to share instructions and a due date."
                action={
                  <button type="button" className="btn btn-primary btn-sm" onClick={openCompose}>
                    <Plus size={15} /> Create assignment
                  </button>
                }
              />
            ) : null}
          </div>
        </>
      )}

      <Sheet
        open={composeOpen}
        title="New assignment"
        subtitle="Give your class clear instructions and a due date."
        onClose={() => {
          setComposeOpen(false);
          setSearchParams(tab === 'assignments' ? { tab: 'assignments' } : {}, {
            replace: true,
          });
        }}
        footer={
          <button
            type="submit"
            form="assignment-form"
            className="btn btn-primary btn-block"
            disabled={busy}
          >
            {busy ? <span className="btn-spinner" /> : <FilePlus2 size={17} />}
            {busy ? 'Creating…' : 'Create assignment'}
          </button>
        }
      >
        <form id="assignment-form" className="form-stack" onSubmit={createAssignment}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Practice set 4 — Quadratic Equations"
              required
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>Class</span>
              <select
                value={form.classIdSection || classes[0]?.id || ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    classIdSection: event.target.value,
                    subject: '',
                  }))
                }
                required
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Subject</span>
              <select
                value={form.subject}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subject: event.target.value }))
                }
                required
              >
                <option value="">Select subject</option>
                {subjectsForClass.map((subject) => (
                  <option key={subject.id} value={subject.subjectName}>
                    {subject.subjectName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Due date</span>
            <input
              type="date"
              min={todayISO()}
              value={form.dueDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, dueDate: event.target.value }))
              }
              required
            />
          </label>
          <label className="field">
            <span>Instructions</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Explain what students need to do and what to bring to class."
            />
          </label>
        </form>
      </Sheet>
    </div>
  );
}
