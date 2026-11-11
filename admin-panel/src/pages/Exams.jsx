import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  Plus,
  Search,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { DonutChart } from '../components/Charts';
import {
  addDaysISO,
  classLabel,
  compareRoll,
  downloadCsv,
  examCategoryLabel,
  examEffectiveStatus,
  formatDate,
  formatTime,
  gradeLetter,
  studentAverage,
  todayISO,
} from '../lib/format';

const CATEGORIES = [
  { value: 'ca1', label: 'CA-1' },
  { value: 'ca2', label: 'CA-2' },
  { value: 'classTest', label: 'Class Test' },
  { value: 'midTerm', label: 'Mid-Term' },
  { value: 'endTerm', label: 'End-Term' },
];
const STATUS_TONE = {
  Open: 'success',
  Upcoming: 'warning',
  Submitted: 'info',
  Locked: 'neutral',
};
const GRADE_COLORS = {
  'A+': '#4338CA',
  A: '#6366F1',
  B: '#0D9488',
  C: '#38BDF8',
  D: '#FACC15',
  E: '#FB923C',
  F: '#EF4444',
};

export default function Exams() {
  const { data, user, notify, refresh } = useAppData();
  const [tab, setTab] = useState('exams');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'ca1',
    classIdSection: data.classes[0]?.id || '',
    subjectId: '',
    date: addDaysISO(todayISO(), 7),
    startTime: '09:00',
    endTime: '11:00',
    maxMarks: 50,
    assignedStaffId: '',
  });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resultExamId, setResultExamId] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [resultStatus, setResultStatus] = useState('all');
  const [resultSort, setResultSort] = useState('roll');
  const [resultDir, setResultDir] = useState('asc');

  const exams = useMemo(
    () =>
      data.exams
        .filter((exam) => {
          const text = search.trim().toLowerCase();
          const matchesSearch =
            !text ||
            exam.title.toLowerCase().includes(text) ||
            exam.subject.toLowerCase().includes(text) ||
            exam.classIdSection.toLowerCase().includes(text);
          const matchesClass = classFilter === 'all' || exam.classIdSection === classFilter;
          const matchesStatus =
            statusFilter === 'all' || examEffectiveStatus(exam) === statusFilter;
          return matchesSearch && matchesClass && matchesStatus;
        })
        .sort((a, b) => new Date(`${b.date}T12:00:00`) - new Date(`${a.date}T12:00:00`)),
    [data.exams, search, classFilter, statusFilter]
  );

  const submittedExams = data.exams.filter((exam) => exam.marksStatus === 'Submitted');
  const selectedResultExam =
    data.exams.find((exam) => exam.id === resultExamId) || submittedExams[0] || null;
  const resultRecords = selectedResultExam
    ? data.testRecords.filter((record) => record.examId === selectedResultExam.id)
    : [];
  const resultRoster = selectedResultExam
    ? data.students
        .filter((student) => student.classIdSection === selectedResultExam.classIdSection)
        .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber))
    : [];
  const resultRows = resultRoster.map((student) => {
    const record = resultRecords.find((entry) => entry.studentId === student.id);
    return {
      student,
      record,
      percentage: record?.percentage ?? null,
    };
  });

  const visibleResultRows = (() => {
    const text = resultSearch.trim().toLowerCase();
    const rows = resultRows.filter(({ student, percentage }) => {
      const overall = studentAverage(data, student.id);
      const status =
        percentage === null ? 'not entered' : percentage < 35 ? 'at risk' : 'passed';
      const haystack = [
        student.name,
        student.rollNumber,
        student.code,
        gradeLetter(percentage),
        status,
        percentage === null ? '' : Math.round(percentage),
        overall === null ? '' : Math.round(overall),
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !text || haystack.includes(text);
      const matchesStatus =
        resultStatus === 'all' ||
        (resultStatus === 'entered' && percentage !== null) ||
        (resultStatus === 'missing' && percentage === null) ||
        (resultStatus === 'passed' && percentage !== null && percentage >= 35) ||
        (resultStatus === 'risk' && percentage !== null && percentage < 35);
      return matchesSearch && matchesStatus;
    });

    const direction = resultDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (resultSort === 'student') return a.student.name.localeCompare(b.student.name) * direction;
      if (resultSort === 'score') {
        return ((a.record?.marksObtained ?? -1) - (b.record?.marksObtained ?? -1)) * direction;
      }
      if (resultSort === 'percentage') {
        return ((a.percentage ?? -1) - (b.percentage ?? -1)) * direction;
      }
      if (resultSort === 'overall') {
        return (
          ((studentAverage(data, a.student.id) ?? -1) -
            (studentAverage(data, b.student.id) ?? -1)) *
          direction
        );
      }
      return compareRoll(a.student.rollNumber, b.student.rollNumber) * direction;
    });
    return rows;
  })();
  const resultAverage = resultRecords.length
    ? Math.round(
        (resultRecords.reduce((sum, record) => sum + record.percentage, 0) /
          resultRecords.length) *
          10
      ) / 10
    : 0;
  const resultPassed = resultRecords.filter((record) => record.percentage >= 35).length;
  const resultHighest = resultRecords.length
    ? Math.max(...resultRecords.map((record) => record.percentage))
    : 0;
  const resultLowest = resultRecords.length
    ? Math.min(...resultRecords.map((record) => record.percentage))
    : 0;
  const gradeDistribution = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'].map((grade) => ({
    label: grade,
    value: resultRows.filter(
      (row) => row.percentage !== null && gradeLetter(row.percentage) === grade
    ).length,
    color: GRADE_COLORS[grade],
  }));

  const subjectOptions = data.subjects.filter(
    (subject) => subject.classIdSection === form.classIdSection
  );

  const openCompose = () => {
    const firstClass = data.classes[0]?.id || '';
    const firstSubject = data.subjects.find((subject) => subject.classIdSection === firstClass);
    setForm({
      title: '',
      category: 'ca1',
      classIdSection: firstClass,
      subjectId: firstSubject?.id || '',
      date: addDaysISO(todayISO(), 7),
      startTime: '09:00',
      endTime: '11:00',
      maxMarks: 50,
      assignedStaffId: firstSubject?.assignedStaffId || '',
    });
    setFormOpen(true);
  };

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const onClassChange = (classIdSection) => {
    const firstSubject = data.subjects.find(
      (subject) => subject.classIdSection === classIdSection
    );
    setForm((current) => ({
      ...current,
      classIdSection,
      subjectId: firstSubject?.id || '',
      assignedStaffId: firstSubject?.assignedStaffId || '',
    }));
  };

  const onSubjectChange = (subjectId) => {
    const subject = data.subjects.find((entry) => entry.id === subjectId);
    setForm((current) => ({
      ...current,
      subjectId,
      assignedStaffId: subject?.assignedStaffId || current.assignedStaffId,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createExam(user.id, form);
      await refresh({ silent: true });
      setFormOpen(false);
      notify('Assessment scheduled and assigned to the teacher.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteExam(user.id, deleteTarget.id);
      await refresh({ silent: true });
      notify('Assessment removed. Related score records were also removed.', 'success');
      setDeleteTarget(null);
      if (resultExamId === deleteTarget.id) setResultExamId('');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportResults = () => {
    if (!selectedResultExam) return;
    downloadCsv(
      `nawaz-results-${selectedResultExam.id}.csv`,
      ['roll_number', 'student_id', 'student_name', 'marks_obtained', 'max_marks', 'percentage', 'grade'],
      resultRows.map(({ student, record, percentage }) => [
        student.rollNumber,
        student.code,
        student.name,
        record?.marksObtained ?? '',
        selectedResultExam.maxMarks,
        percentage ?? '',
        percentage !== null ? gradeLetter(percentage) : '',
      ])
    );
    notify('Result sheet exported.', 'success');
  };

  const openCount = data.exams.filter((exam) => examEffectiveStatus(exam) === 'Open').length;
  const upcomingCount = data.exams.filter((exam) => examEffectiveStatus(exam) === 'Upcoming').length;

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Assessment & results"
        title="Exams & marks"
        subtitle="Schedule assessments, assign marking responsibility and review the result matrix."
        actions={
          <button type="button" className="admin-btn admin-btn-primary" onClick={openCompose}>
            <Plus size={16} /> Schedule exam
          </button>
        }
      />

      <div className="mini-stat-row">
        <div className="mini-stat">
          <span>Total assessments</span>
          <strong>{data.exams.length}</strong>
          <small>{submittedExams.length} with results</small>
        </div>
        <div className="mini-stat success">
          <span>Open for marks</span>
          <strong>{openCount}</strong>
          <small>teacher action needed</small>
        </div>
        <div className="mini-stat warning">
          <span>Upcoming</span>
          <strong>{upcomingCount}</strong>
          <small>scheduled ahead</small>
        </div>
        <div className="mini-stat info">
          <span>School average</span>
          <strong>
            {data.testRecords.length
              ? `${Math.round(
                  (data.testRecords.reduce((sum, record) => sum + record.percentage, 0) /
                    data.testRecords.length) *
                    10
                ) / 10}%`
              : '—'}
          </strong>
          <small>across submitted marks</small>
        </div>
      </div>

      <div className="admin-tabs">
        <button type="button" className={tab === 'exams' ? 'active' : ''} onClick={() => setTab('exams')}>
          <ClipboardCheck size={16} /> Assessments
        </button>
        <button type="button" className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>
          <BarChart3 size={16} /> Result matrix
        </button>
      </div>

      {tab === 'exams' ? (
        <section className="admin-card table-card">
          <div className="table-toolbar">
            <div className="admin-search">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assessments or subjects"
              />
            </div>
            <div className="table-toolbar-filters">
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="all">All classes</option>
                {data.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.displayName}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {['Upcoming', 'Open', 'Submitted', 'Locked'].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <span className="table-result-count">{exams.length} assessments</span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Class</th>
                  <th>Date &amp; time</th>
                  <th>Assigned to</th>
                  <th>Max</th>
                  <th>Status</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => {
                  const status = examEffectiveStatus(exam);
                  const teacher = data.staff.find(
                    (member) => member.id === exam.assignedStaffId
                  );
                  const records = data.testRecords.filter(
                    (record) => record.examId === exam.id
                  );
                  return (
                    <tr key={exam.id}>
                      <td>
                        <span className="table-stack">
                          <strong>{exam.title}</strong>
                          <small>
                            {exam.subject} · {examCategoryLabel(exam.category)}
                            {records.length ? ` · ${records.length} scores` : ''}
                          </small>
                        </span>
                      </td>
                      <td>
                        <span className="table-class-badge">{exam.classIdSection}</span>
                      </td>
                      <td>
                        <span className="table-stack">
                          <strong>{formatDate(exam.date)}</strong>
                          <small>
                            {formatTime(exam.startTime)} – {formatTime(exam.endTime)}
                          </small>
                        </span>
                      </td>
                      <td>
                        <span className="table-person muted-person">
                          <Avatar name={teacher?.name} size={28} photo={teacher?.photo} />
                          <span>
                            <strong>{teacher?.name || 'Unassigned'}</strong>
                            <small>{teacher?.department}</small>
                          </span>
                        </span>
                      </td>
                      <td>{exam.maxMarks}</td>
                      <td>
                        <Badge tone={STATUS_TONE[status]} dot>
                          {status}
                        </Badge>
                      </td>
                      <td>
                        <div className="table-actions">
                          {status === 'Submitted' ? (
                            <button
                              type="button"
                              className="table-action"
                              title="View results"
                              onClick={() => {
                                setResultExamId(exam.id);
                                setTab('results');
                              }}
                            >
                              <BarChart3 size={15} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="table-action danger"
                            onClick={() => setDeleteTarget(exam)}
                            aria-label={`Delete ${exam.title}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!exams.length ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={ClipboardCheck}
                        title="No assessments match these filters"
                        message="Schedule a new exam or adjust the filters."
                        compact
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>Marks entry opens automatically when an exam concludes.</span>
            <Badge tone="brand">35% pass threshold</Badge>
          </div>
        </section>
      ) : (
        <>
          {submittedExams.length ? (
            <>
              <div className="results-toolbar">
                <div className="result-exam-select">
                  <span>Assessment</span>
                  <select
                    value={selectedResultExam?.id || ''}
                    onChange={(event) => setResultExamId(event.target.value)}
                  >
                    {submittedExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title} · {classLabel(data, exam.classIdSection)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </div>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={exportResults}>
                  <Download size={16} /> Export results
                </button>
              </div>

              <div className="results-summary-grid">
                <section className="result-hero-card">
                  <span className="result-hero-icon">
                    <Trophy size={24} />
                  </span>
                  <div>
                    <span className="admin-eyebrow">{examCategoryLabel(selectedResultExam.category)}</span>
                    <h2>{selectedResultExam.title}</h2>
                    <p>
                      {selectedResultExam.subject} · {classLabel(data, selectedResultExam.classIdSection)} ·{' '}
                      {formatDate(selectedResultExam.date)} · Max {selectedResultExam.maxMarks}
                    </p>
                  </div>
                  <div className="result-hero-score">
                    <strong>{resultAverage}%</strong>
                    <span>class average</span>
                  </div>
                </section>
                <div className="result-kpis">
                  <div>
                    <span>Students scored</span>
                    <strong>{resultRecords.length}/{resultRoster.length}</strong>
                  </div>
                  <div>
                    <span>Passed (≥35%)</span>
                    <strong>{resultPassed}</strong>
                  </div>
                  <div>
                    <span>Highest</span>
                    <strong>{resultHighest ? `${Math.round(resultHighest)}%` : '—'}</strong>
                  </div>
                  <div>
                    <span>Lowest</span>
                    <strong>{resultLowest ? `${Math.round(resultLowest)}%` : '—'}</strong>
                  </div>
                </div>
              </div>

              <div className="results-layout">
                <section className="admin-card table-card result-table-card">
                  <div className="admin-card-head">
                    <div>
                      <h2>Result matrix</h2>
                      <p>Search, filter and sort every column of the result sheet.</p>
                    </div>
                    <Badge tone="success" icon={CheckCircle2}>
                      Marks submitted
                    </Badge>
                  </div>
                  <div className="result-filter-bar">
                    <div className="admin-search result-search">
                      <Search size={16} />
                      <input
                        type="search"
                        value={resultSearch}
                        onChange={(event) => setResultSearch(event.target.value)}
                        placeholder="Search student, roll, grade, status"
                        aria-label="Search the result matrix"
                      />
                    </div>
                    <label className="result-filter">
                      <span>Show</span>
                      <select
                        value={resultStatus}
                        onChange={(event) => setResultStatus(event.target.value)}
                        aria-label="Filter results by status"
                      >
                        <option value="all">All students</option>
                        <option value="entered">Marks entered</option>
                        <option value="missing">Not entered</option>
                        <option value="passed">Passed</option>
                        <option value="risk">At risk</option>
                      </select>
                    </label>
                    <label className="result-filter">
                      <span>Sort by</span>
                      <select
                        value={resultSort}
                        onChange={(event) => setResultSort(event.target.value)}
                        aria-label="Sort the result matrix"
                      >
                        <option value="roll">Roll number</option>
                        <option value="student">Student name</option>
                        <option value="score">Score</option>
                        <option value="percentage">Percentage</option>
                        <option value="overall">Overall average</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => setResultDir((current) => (current === 'asc' ? 'desc' : 'asc'))}
                      aria-label={`Sort ${resultDir === 'asc' ? 'descending' : 'ascending'}`}
                    >
                      <ArrowDownUp size={14} />
                      {resultDir === 'asc' ? 'Ascending' : 'Descending'}
                    </button>
                    <Badge tone="neutral">
                      {visibleResultRows.length}/{resultRows.length}
                    </Badge>
                  </div>
                  <div className="table-scroll">
                    <table className="admin-table compact-table">
                      <thead>
                        <tr>
                          <th>Roll</th>
                          <th>Student</th>
                          <th>Score</th>
                          <th>Percentage</th>
                          <th>Grade</th>
                          <th>Overall average</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleResultRows.map(({ student, record, percentage }) => {
                          const overall = studentAverage(data, student.id);
                          return (
                            <tr key={student.id}>
                              <td>{student.rollNumber}</td>
                              <td>
                                <span className="table-person muted-person">
                                  <Avatar name={student.name} size={30} photo={student.photo} />
                                  <span>
                                    <strong>{student.name}</strong>
                                    <small>{student.code}</small>
                                  </span>
                                </span>
                              </td>
                              <td>
                                <strong>
                                  {record?.marksObtained ?? '—'}/{selectedResultExam.maxMarks}
                                </strong>
                              </td>
                              <td>{percentage !== null ? `${Math.round(percentage)}%` : '—'}</td>
                              <td>
                                {percentage !== null ? (
                                  <Badge tone={percentage < 35 ? 'danger' : 'success'}>
                                    {gradeLetter(percentage)}
                                  </Badge>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>{overall !== null ? `${Math.round(overall)}%` : '—'}</td>
                              <td>
                                {percentage === null ? (
                                  <Badge tone="neutral">Not entered</Badge>
                                ) : percentage < 35 ? (
                                  <Badge tone="danger">At risk</Badge>
                                ) : (
                                  <Badge tone="success">Passed</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {!visibleResultRows.length ? (
                          <tr>
                            <td colSpan={7}>
                              <span className="table-empty-note">
                                No students match this search or filter.
                              </span>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <aside className="results-aside">
                  <section className="admin-card grade-distribution">
                    <div className="admin-card-head">
                      <div>
                        <h2>Grade distribution</h2>
                        <p>This assessment</p>
                      </div>
                      <Award size={18} className="muted-icon" />
                    </div>
                    <DonutChart
                      data={gradeDistribution}
                      size={190}
                      thickness={24}
                      centerValue={resultRecords.length}
                      centerLabel="students"
                      ariaLabel="Grade distribution"
                    />
                    <div className="grade-legend">
                      {gradeDistribution.map((grade) => (
                        <span key={grade.label}>
                          <i style={{ background: grade.color }} />
                          {grade.label}
                          <strong>{grade.value}</strong>
                        </span>
                      ))}
                    </div>
                  </section>
                  <section className="admin-card result-note">
                    <div className="admin-card-head">
                      <div>
                        <h2>Result note</h2>
                        <p>Shared with the teacher workspace</p>
                      </div>
                    </div>
                    <p>
                      Scores are locked after the assigned teacher submits them. Administrators can
                      review the values here; corrections require an explicit admin edit in a future
                      release.
                    </p>
                    <div className="result-note-foot">
                      <span>
                        <Users size={14} /> {resultRoster.length} students
                      </span>
                      <span>
                        <CalendarDays size={14} /> {formatDate(selectedResultExam.date)}
                      </span>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No submitted results yet"
              message="When a teacher submits marks for an exam, the result matrix will appear here."
            />
          )}
        </>
      )}

      <Modal
        open={formOpen}
        title="Schedule an assessment"
        subtitle="The assigned teacher can enter marks after the exam concludes."
        icon={ClipboardCheck}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="exam-form" className="admin-btn admin-btn-primary" disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <ClipboardCheck size={16} />}
              {busy ? 'Scheduling…' : 'Schedule exam'}
            </button>
          </div>
        }
      >
        <form id="exam-form" className="admin-form-grid" onSubmit={submit}>
          <label className="admin-field admin-span-2">
            <span>Assessment title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="e.g. Mathematics CA-2"
              required
            />
          </label>
          <label className="admin-field">
            <span>Category</span>
            <select value={form.category} onChange={(event) => setField('category', event.target.value)}>
              {CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Class</span>
            <select
              value={form.classIdSection}
              onChange={(event) => onClassChange(event.target.value)}
            >
              {data.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Subject</span>
            <select
              value={form.subjectId}
              onChange={(event) => onSubjectChange(event.target.value)}
              required
            >
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.subjectName}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Assigned teacher</span>
            <select
              value={form.assignedStaffId}
              onChange={(event) => setField('assignedStaffId', event.target.value)}
            >
              {data.staff
                .filter((member) => member.accessLevel === 'TeacherApp' && member.isActive)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Exam date</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => setField('date', event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Max marks</span>
            <input
              type="number"
              min="1"
              value={form.maxMarks}
              onChange={(event) => setField('maxMarks', Number(event.target.value))}
              required
            />
          </label>
          <label className="admin-field">
            <span>Start time</span>
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => setField('startTime', event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>End time</span>
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => setField('endTime', event.target.value)}
            />
          </label>
          <p className="admin-form-note admin-span-2">
            Marks entry opens automatically after the end time. The deadline is the end of the exam
            day in this prototype.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete this assessment?"
        subtitle="All score records for this exam will be removed."
        icon={Trash2}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDeleteTarget(null)}>
              Keep exam
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={remove} disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <Trash2 size={15} />}
              {busy ? 'Deleting…' : 'Delete assessment'}
            </button>
          </div>
        }
      >
        {deleteTarget ? (
          <div className="delete-summary">
            <span className="delete-icon">
              <ClipboardCheck size={24} />
            </span>
            <div>
              <strong>{deleteTarget.title}</strong>
              <span>
                {deleteTarget.subject} · {classLabel(data, deleteTarget.classIdSection)} ·{' '}
                {formatDate(deleteTarget.date)}
              </span>
              <p>This will also delete any marks already submitted for the assessment.</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
