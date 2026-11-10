import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  LockKeyhole,
  RotateCcw,
  Send,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import ProgressRing from '../components/ProgressRing';
import Sheet from '../components/Sheet';
import {
  categoryLabel,
  classLabel,
  compareRoll,
  examEffectiveStatus,
  formatDate,
  formatTime,
  studentScores,
} from '../lib/format';

export default function MarksEntry() {
  const { examId } = useParams();
  const { data, user, notify, refresh } = useAppData();
  const navigate = useNavigate();
  const exam = data.exams.find((entry) => entry.id === examId);
  const status = exam ? examEffectiveStatus(exam) : 'Upcoming';
  const isMine = exam?.assignedStaffId === user.id;
  const assignedTeacher = data.staff.find(
    (member) => member.id === exam?.assignedStaffId
  );
  const roster = useMemo(
    () =>
      exam
        ? data.students
            .filter((student) => student.classIdSection === exam.classIdSection)
            .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber))
        : [],
    [data.students, exam]
  );
  const existingRecords = useMemo(
    () => (exam ? data.testRecords.filter((record) => record.examId === exam.id) : []),
    [data.testRecords, exam]
  );
  const [scores, setScores] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!exam) return;
    const existing = new Map(
      data.testRecords
        .filter((record) => record.examId === exam.id)
        .map((record) => [record.studentId, record.marksObtained])
    );
    setScores(
      Object.fromEntries(
        roster.map((student) => [student.id, existing.get(student.id) ?? ''])
      )
    );
  }, [examId, exam?.marksStatus, roster.length]);

  if (!exam) {
    return (
      <div className="t-page">
        <PageHead backTo="/tasks?tab=exams" title="Assessment not found" />
        <EmptyState icon={ClipboardCheck} title="This assessment is no longer available." />
      </div>
    );
  }
  if (!isMine && status !== 'Submitted') {
    return (
      <div className="t-page">
        <PageHead backTo="/tasks?tab=exams" title="Not your assessment" />
        <EmptyState
          icon={LockKeyhole}
          title="This assessment is assigned to another teacher"
          message={`${assignedTeacher?.name || 'The assigned teacher'} is responsible for marks entry. You can return to the school exam list to see its progress.`}
        />
      </div>
    );
  }

  const enteredValues = roster
    .map((student) => ({ student, raw: scores[student.id] }))
    .filter((entry) => entry.raw !== '' && entry.raw !== undefined && entry.raw !== null)
    .map((entry) => Number(entry.raw));
  const allEntered =
    roster.length > 0 &&
    roster.every((student) => {
      const value = Number(scores[student.id]);
      return (
        scores[student.id] !== '' &&
        scores[student.id] !== undefined &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= exam.maxMarks
      );
    });
  const average = enteredValues.length
    ? Math.round(
        (enteredValues.reduce((sum, value) => sum + value, 0) /
          enteredValues.length /
          exam.maxMarks) *
          1000
      ) / 10
    : 0;
  const belowThreshold = enteredValues.filter(
    (value) => (value / exam.maxMarks) * 100 < 35
  ).length;
  const missingCount = roster.length - enteredValues.length;

  const setScore = (studentId, value) => {
    setScores((current) => ({ ...current, [studentId]: value }));
  };

  const fillWith = (percentage) => {
    const value = percentage === 1 ? exam.maxMarks : Math.round(exam.maxMarks * percentage);
    setScores(Object.fromEntries(roster.map((student) => [student.id, value])));
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.submitMarks(
        user.id,
        exam.id,
        roster.map((student) => ({
          studentId: student.id,
          marksObtained: Number(scores[student.id]),
        }))
      );
      await refresh({ silent: true });
      setConfirmOpen(false);
      notify(`${exam.title} marks submitted for ${roster.length} students.`, 'success');
      navigate('/tasks?tab=exams', { replace: true });
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submittedRecords = [...existingRecords].sort((a, b) => {
    const studentA = data.students.find((student) => student.id === a.studentId);
    const studentB = data.students.find((student) => student.id === b.studentId);
    return (studentA?.rollNumber || '').localeCompare(studentB?.rollNumber || '');
  });

  return (
    <div className="t-page marks-entry-page">
      <PageHead
        backTo="/tasks?tab=exams"
        eyebrow={categoryLabel(exam.category)}
        title={exam.title}
        subtitle={`${exam.subject} · ${classLabel(data, exam.classIdSection)}`}
        action={<Badge tone={status === 'Submitted' ? 'success' : status === 'Open' ? 'brand' : 'warning'}>{status}</Badge>}
      />

      <section className="exam-hero">
        <div className="exam-hero-icon">
          <ClipboardCheck size={26} />
        </div>
        <div className="exam-hero-details">
          <span>
            <BookOpen size={13} /> {exam.subject}
          </span>
          <span>
            <Clock3 size={13} /> {formatDate(exam.date)} · {formatTime(exam.startTime)} –{' '}
            {formatTime(exam.endTime)}
          </span>
          <span>
            <Users size={13} /> {roster.length} students · Max {exam.maxMarks} marks
          </span>
        </div>
      </section>

      {!isMine ? (
        <div className="status-note info">
          <Eye size={15} />
          <span>
            <strong>Read-only view.</strong> Marks for this assessment were entered by{' '}
            {assignedTeacher?.name || 'the assigned teacher'}. Only the assigned teacher can
            evaluate this exam.
          </span>
        </div>
      ) : null}

      {status === 'Upcoming' ? (
        <div className="locked-card">
          <span className="locked-icon">
            <LockKeyhole size={22} />
          </span>
          <div>
            <strong>Marks entry is locked</strong>
            <p>
              This page opens automatically after the exam ends on {formatDate(exam.date)} at{' '}
              {formatTime(exam.endTime)}. No action is needed from you.
            </p>
          </div>
        </div>
      ) : status === 'Submitted' ? (
        <>
          <section className="card submitted-summary">
            <ProgressRing
              value={
                submittedRecords.length
                  ? Math.round(
                      (submittedRecords.reduce(
                        (sum, record) => sum + record.percentage,
                        0
                      ) /
                        submittedRecords.length) *
                        10
                    ) / 10
                  : 0
              }
              size={104}
              stroke={10}
              color="var(--success)"
              track="var(--slate-100)"
            >
              <strong>
                {submittedRecords.length
                  ? `${Math.round(
                      submittedRecords.reduce(
                        (sum, record) => sum + record.percentage,
                        0
                      ) / submittedRecords.length
                    )}%`
                  : '—'}
              </strong>
              <span>average</span>
            </ProgressRing>
            <div>
              <h2>Marks submitted</h2>
              <p>
                {isMine
                  ? `${submittedRecords.length} scores are locked and visible to the admin console. Corrections require an administrator.`
                  : `${submittedRecords.length} scores were submitted by ${assignedTeacher?.name || 'the assigned teacher'}. This result is read-only for you.`}
              </p>
              <div className="submitted-pills">
                <Badge tone="success" icon={CheckCircle2}>
                  Submitted
                </Badge>
                {!isMine ? (
                  <Badge tone="neutral" icon={Eye}>
                    Read-only
                  </Badge>
                ) : null}
                <Badge tone="neutral">Pass mark 35%</Badge>
              </div>
            </div>
          </section>

          <div className="score-table">
            <div className="score-table-head">
              <span>Student</span>
              <span>Score</span>
              <span>Percent</span>
            </div>
            {submittedRecords.map((record) => {
              const student = data.students.find((entry) => entry.id === record.studentId);
              return (
                <div key={record.id} className="score-table-row">
                  <span className="score-table-student">
                    <Avatar name={record.studentName} size={32} />
                    <span>
                      <strong>{record.studentName}</strong>
                      <small>Roll {student?.rollNumber || '—'}</small>
                    </span>
                  </span>
                  <strong>
                    {record.marksObtained}/{record.maxMarks}
                  </strong>
                  <Badge tone={record.percentage < 35 ? 'danger' : 'success'}>
                    {Math.round(record.percentage)}%
                  </Badge>
                </div>
              );
            })}
          </div>
        </>
      ) : status === 'Locked' ? (
        <div className="locked-card">
          <span className="locked-icon">
            <LockKeyhole size={22} />
          </span>
          <div>
            <strong>Assessment locked</strong>
            <p>An administrator has locked this assessment. Contact the office for a correction.</p>
          </div>
        </div>
      ) : (
        <>
          <section className="card live-summary">
            <ProgressRing
              value={average}
              size={96}
              stroke={9}
              color={average >= 50 ? 'var(--success)' : 'var(--warning)'}
              track="var(--slate-100)"
            >
              <strong>{average}%</strong>
              <span>average</span>
            </ProgressRing>
            <div className="live-summary-text">
              <h2>Class performance</h2>
              <p>
                {enteredValues.length} of {roster.length} scores entered
                {missingCount ? ` · ${missingCount} still missing` : ' · ready to submit'}.
              </p>
              <div className="live-badges">
                <Badge tone="neutral">{enteredValues.length}/{roster.length} entered</Badge>
                {belowThreshold ? (
                  <Badge tone="danger" icon={TriangleAlert}>
                    {belowThreshold} below 35%
                  </Badge>
                ) : (
                  <Badge tone="success" icon={CheckCircle2}>
                    No one below 35%
                  </Badge>
                )}
              </div>
            </div>
          </section>

          <div className="marks-toolbar">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillWith(0.7)}>
              <Sparkles size={15} /> Fill 70%
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillWith(1)}>
              Fill full marks
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setScores(Object.fromEntries(roster.map((student) => [student.id, ''])))}
            >
              <RotateCcw size={15} /> Clear
            </button>
          </div>

          <div className="marks-list">
            {roster.map((student) => {
              const raw = scores[student.id];
              const numeric = Number(raw);
              const valid = raw !== '' && Number.isFinite(numeric) && numeric >= 0 && numeric <= exam.maxMarks;
              const percent = valid ? (numeric / exam.maxMarks) * 100 : null;
              const pastScores = studentScores(data, student.id).slice(0, 1);
              return (
                <div key={student.id} className={`mark-row ${valid && percent < 35 ? 'mark-row-low' : ''}`}>
                  <div className="mark-student">
                    <Avatar name={student.name} size={36} />
                    <span>
                      <strong>{student.name}</strong>
                      <small>
                        Roll {student.rollNumber}
                        {pastScores.length
                          ? ` · last ${Math.round(pastScores[0].percentage)}%`
                          : ' · no prior score'}
                      </small>
                    </span>
                  </div>
                  <div className="mark-input-wrap">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={exam.maxMarks}
                      step="0.5"
                      value={raw ?? ''}
                      onChange={(event) => setScore(student.id, event.target.value)}
                      placeholder="—"
                      aria-label={`Marks for ${student.name}`}
                    />
                    <span>/ {exam.maxMarks}</span>
                  </div>
                  <span className={`mark-percent ${percent !== null && percent < 35 ? 'low' : ''}`}>
                    {percent === null ? 'Enter score' : `${Math.round(percent)}%`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="sticky-save">
            <div className="sticky-save-info">
              <span>{allEntered ? 'Ready to submit' : `${missingCount} scores missing`}</span>
              <strong>
                {enteredValues.length}/{roster.length} entered
              </strong>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!allEntered || saving}
              onClick={() => setConfirmOpen(true)}
            >
              <Send size={17} /> Submit marks
            </button>
          </div>
        </>
      )}

      <Sheet
        open={confirmOpen}
        title="Submit marks?"
        subtitle="This will lock the assessment for teaching staff."
        onClose={() => setConfirmOpen(false)}
        footer={
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
              Keep editing
            </button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <CheckCircle2 size={17} />}
              {saving ? 'Submitting…' : 'Confirm & submit'}
            </button>
          </div>
        }
      >
        <div className="confirm-summary">
          <span className="confirm-icon">
            <ClipboardCheck size={26} />
          </span>
          <h3>{exam.title}</h3>
          <p>
            {roster.length} scores for {classLabel(data, exam.classIdSection)} will be saved and
            locked. The class average is <strong>{average}%</strong>.
          </p>
          <div className="confirm-grid">
            <div>
              <span>Entered</span>
              <strong>{enteredValues.length}/{roster.length}</strong>
            </div>
            <div>
              <span>Below 35%</span>
              <strong>{belowThreshold}</strong>
            </div>
            <div>
              <span>Max marks</span>
              <strong>{exam.maxMarks}</strong>
            </div>
          </div>
          {belowThreshold ? (
            <div className="status-note warning">
              <TriangleAlert size={15} />
              {belowThreshold} student{belowThreshold > 1 ? 's are' : ' is'} below the 35% risk
              threshold. Review the scores before submitting.
            </div>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
