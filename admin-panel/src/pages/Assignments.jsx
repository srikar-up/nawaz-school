import { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FilePlus2,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import {
  addDaysISO,
  classLabel,
  formatDate,
  todayISO,
} from '../lib/format';

const STATUS_OPTIONS = ['Assigned', 'Draft', 'Reviewed'];

export default function Assignments() {
  const { data, user, notify, refresh } = useAppData();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    classIdSection: data.classes[0]?.id || '',
    subject: '',
    dueDate: addDaysISO(todayISO(), 7),
    description: '',
    status: 'Assigned',
  });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const assignments = useMemo(
    () =>
      data.assignments
        .filter((assignment) => {
          const text = search.trim().toLowerCase();
          const matchesSearch =
            !text ||
            assignment.title.toLowerCase().includes(text) ||
            assignment.subject.toLowerCase().includes(text) ||
            assignment.description.toLowerCase().includes(text);
          const matchesClass =
            classFilter === 'all' || assignment.classIdSection === classFilter;
          const matchesStatus =
            statusFilter === 'all' || assignment.status === statusFilter;
          return matchesSearch && matchesClass && matchesStatus;
        })
        .sort((a, b) => {
          if (a.status === 'Reviewed' && b.status !== 'Reviewed') return 1;
          if (b.status === 'Reviewed' && a.status !== 'Reviewed') return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        }),
    [data.assignments, search, classFilter, statusFilter]
  );

  const openCount = data.assignments.filter((assignment) => assignment.status !== 'Reviewed').length;
  const overdueCount = data.assignments.filter(
    (assignment) => assignment.status !== 'Reviewed' && assignment.dueDate < todayISO()
  ).length;
  const reviewedCount = data.assignments.filter((assignment) => assignment.status === 'Reviewed').length;
  const classIds = new Set(data.assignments.map((assignment) => assignment.classIdSection));
  const subjectOptions = data.subjects.filter(
    (subject) => subject.classIdSection === form.classIdSection
  );

  const openCompose = () => {
    const firstClass = data.classes[0]?.id || '';
    const firstSubject = data.subjects.find(
      (subject) => subject.classIdSection === firstClass
    );
    setForm({
      title: '',
      classIdSection: firstClass,
      subject: firstSubject?.subjectName || '',
      dueDate: addDaysISO(todayISO(), 7),
      description: '',
      status: 'Assigned',
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
      subject: firstSubject?.subjectName || '',
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createAssignment(user.id, form);
      await refresh({ silent: true });
      setFormOpen(false);
      notify('Assignment created for the class.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (assignment, status) => {
    setUpdatingId(assignment.id);
    try {
      await api.updateAssignment(user.id, assignment.id, { status });
      await refresh({ silent: true });
      notify(`Assignment marked ${status.toLowerCase()}.`, 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteAssignment(user.id, deleteTarget.id);
      await refresh({ silent: true });
      notify('Assignment removed.', 'success');
      setDeleteTarget(null);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Classwork"
        title="Assignments"
        subtitle="Classwork set by teachers and the school office, with due dates and review status."
        actions={
          <button type="button" className="admin-btn admin-btn-primary" onClick={openCompose}>
            <Plus size={16} /> New assignment
          </button>
        }
      />

      <div className="mini-stat-row">
        <div className="mini-stat">
          <span>Active assignments</span>
          <strong>{openCount}</strong>
          <small>across {classIds.size} classes</small>
        </div>
        <div className="mini-stat danger">
          <span>Overdue</span>
          <strong>{overdueCount}</strong>
          <small>past the due date</small>
        </div>
        <div className="mini-stat success">
          <span>Reviewed</span>
          <strong>{reviewedCount}</strong>
          <small>closed by teachers</small>
        </div>
        <div className="mini-stat info">
          <span>Total</span>
          <strong>{data.assignments.length}</strong>
          <small>classwork records</small>
        </div>
      </div>

      <section className="admin-card table-card">
        <div className="table-toolbar">
          <div className="admin-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assignments, subjects or instructions"
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
              {STATUS_OPTIONS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <span className="table-result-count">{assignments.length} assignments</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Due</th>
                <th>Created by</th>
                <th>Status</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const creator = data.staff.find(
                  (member) => member.id === assignment.createdByStaffId
                );
                const overdue =
                  assignment.status !== 'Reviewed' && assignment.dueDate < todayISO();
                return (
                  <tr key={assignment.id}>
                    <td>
                      <span className="table-stack assignment-title-cell">
                        <strong>{assignment.title}</strong>
                        <small>{assignment.description || 'No instructions'}</small>
                      </span>
                    </td>
                    <td>
                      <span className="table-class-badge">{assignment.classIdSection}</span>
                    </td>
                    <td>{assignment.subject}</td>
                    <td>
                      <span className="table-stack">
                        <strong>{formatDate(assignment.dueDate)}</strong>
                        <small>
                          {overdue ? 'Overdue' : assignment.dueDate === todayISO() ? 'Due today' : 'Upcoming'}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className="table-person muted-person">
                        <Avatar name={creator?.name} size={28} />
                        <span>
                          <strong>{creator?.name || 'School office'}</strong>
                          <small>{creator?.staffType}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <select
                        className="table-inline-select"
                        value={assignment.status}
                        onChange={(event) => updateStatus(assignment, event.target.value)}
                        disabled={updatingId === assignment.id}
                        aria-label={`Status for ${assignment.title}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action danger"
                          onClick={() => setDeleteTarget(assignment)}
                          aria-label={`Delete ${assignment.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!assignments.length ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={ClipboardList}
                      title="No assignments match these filters"
                      message="Create a new assignment or clear the filters."
                      compact
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>
            <ClipboardList size={14} /> Teachers can create and review assignments from their mobile
            workspace.
          </span>
          <Badge tone="brand">{reviewedCount} reviewed</Badge>
        </div>
      </section>

      <Modal
        open={formOpen}
        title="Create an assignment"
        subtitle="This will appear in the teacher workspace and the class records."
        icon={FilePlus2}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="assignment-admin-form" className="admin-btn admin-btn-primary" disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <FilePlus2 size={16} />}
              {busy ? 'Creating…' : 'Create assignment'}
            </button>
          </div>
        }
      >
        <form id="assignment-admin-form" className="admin-form-grid" onSubmit={submit}>
          <label className="admin-field admin-span-2">
            <span>Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="e.g. Revision worksheet — Trigonometry"
              required
            />
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
            <select value={form.subject} onChange={(event) => setField('subject', event.target.value)}>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.subjectName}>
                  {subject.subjectName}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Due date</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => setField('dueDate', event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setField('status', event.target.value)}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="admin-field admin-span-2">
            <span>Instructions</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
              placeholder="Explain what students need to do and what to submit."
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete assignment?"
        subtitle="This removes it from the teacher workspace."
        icon={Trash2}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDeleteTarget(null)}>
              Keep assignment
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={remove} disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <Trash2 size={15} />}
              {busy ? 'Deleting…' : 'Delete assignment'}
            </button>
          </div>
        }
      >
        {deleteTarget ? (
          <div className="delete-summary">
            <span className="delete-icon">
              <ClipboardList size={24} />
            </span>
            <div>
              <strong>{deleteTarget.title}</strong>
              <span>
                {deleteTarget.subject} · {classLabel(data, deleteTarget.classIdSection)} · Due{' '}
                {formatDate(deleteTarget.dueDate)}
              </span>
              <p>Students will no longer see this assignment in their classwork list.</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
