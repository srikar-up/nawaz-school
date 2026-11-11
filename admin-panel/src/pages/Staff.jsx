import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck2,
  ChevronRight,
  Download,
  GraduationCap,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import PhotoPicker from '../components/PhotoPicker';
import Badge from '../components/Badge';
import Drawer from '../components/Drawer';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import {
  accessTone,
  downloadCsv,
  formatDate,
  relativeTime,
  todayISO,
} from '../lib/format';

const STAFF_TYPES = [
  'Principal',
  'Vice Principal',
  'Teacher',
  'Operator',
  'Electrician',
  'Bus Driver',
  'Support Staff',
];
const ACCESS_LEVELS = ['SuperAdmin', 'SubAdmin', 'TeacherApp', 'NoAccess'];

function emptyForm() {
  return {
    name: '',
    email: '',
    phone: '',
    staffType: 'Teacher',
    department: '',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: todayISO(),
  };
}

export default function Staff() {
  const { data, user, permissions, notify, refresh } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [accessFilter, setAccessFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const today = todayISO();
  const staffParam = searchParams.get('staff');
  const selectedStaff = staffParam
    ? data.staff.find((member) => member.id === staffParam)
    : null;

  const attendanceFor = (staffId) =>
    data.staffAttendance.find((record) => record.staffId === staffId && record.date === today);

  const filtered = useMemo(
    () =>
      data.staff
        .filter((member) => {
          const text = search.trim().toLowerCase();
          const matchesSearch =
            !text ||
            member.name.toLowerCase().includes(text) ||
            member.email.toLowerCase().includes(text) ||
            member.department.toLowerCase().includes(text) ||
            member.code.toLowerCase().includes(text);
          const matchesAccess = accessFilter === 'all' || member.accessLevel === accessFilter;
          const matchesType = typeFilter === 'all' || member.staffType === typeFilter;
          return matchesSearch && matchesAccess && matchesType;
        })
        .sort((a, b) => {
          const order = { SuperAdmin: 0, SubAdmin: 1, TeacherApp: 2, NoAccess: 3 };
          return (
            (order[a.accessLevel] ?? 4) - (order[b.accessLevel] ?? 4) ||
            a.name.localeCompare(b.name)
          );
        }),
    [data.staff, search, accessFilter, typeFilter]
  );

  if (!permissions.superAdmin) {
    return (
      <div className="admin-page">
        <PageHeader eyebrow="Staff & access" title="Restricted area" />
        <div className="admin-card access-denied">
          <span className="access-denied-icon">
            <LockKeyhole size={26} />
          </span>
          <h2>SuperAdmin clearance required</h2>
          <p>
            Staff records, access levels and role changes are restricted to the principal. You are
            signed in as a SubAdmin operator.
          </p>
        </div>
      </div>
    );
  }

  const teachers = data.staff.filter((member) => member.staffType === 'Teacher');
  const admins = data.staff.filter((member) => ['SuperAdmin', 'SubAdmin'].includes(member.accessLevel));
  const support = data.staff.filter((member) => member.accessLevel === 'NoAccess');
  const presentToday = data.staffAttendance.filter(
    (record) => record.date === today && record.status === 'Present'
  ).length;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      staffType: member.staffType,
      department: member.department || '',
      accessLevel: member.accessLevel,
      isActive: member.isActive,
      joinedOn: member.joinedOn || todayISO(),
    });
    if (staffParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('staff');
      setSearchParams(next, { replace: true });
    }
    setFormOpen(true);
  };

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api.updateStaff(user.id, editing.id, form);
        notify(`${form.name}’s access updated.`, 'success');
      } else {
        await api.createStaff(user.id, form);
        notify(`${form.name} added to the staff directory.`, 'success');
      }
      await refresh({ silent: true });
      setFormOpen(false);
      setEditing(null);
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
      await api.deleteStaff(user.id, deleteTarget.id);
      await refresh({ silent: true });
      notify(`${deleteTarget.name} removed from the staff directory.`, 'success');
      setDeleteTarget(null);
      if (staffParam === deleteTarget.id) {
        const next = new URLSearchParams(searchParams);
        next.delete('staff');
        setSearchParams(next, { replace: true });
      }
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      'nawaz-staff.csv',
      ['staff_id', 'name', 'email', 'phone', 'staff_type', 'access_level', 'department', 'active'],
      filtered.map((member) => [
        member.code,
        member.name,
        member.email,
        member.phone,
        member.staffType,
        member.accessLevel,
        member.department,
        member.isActive ? 'Active' : 'Inactive',
      ])
    );
    notify(`Exported ${filtered.length} staff records.`, 'success');
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="People & permissions"
        title="Staff & access"
        subtitle="One directory for teaching, operations and support staff — with clear access levels."
        actions={
          <>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={exportCsv}>
              <Download size={16} /> Export
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={openAdd}>
              <UserPlus size={16} /> Add staff
            </button>
          </>
        }
      />

      <div className="mini-stat-row">
        <div className="mini-stat">
          <span>Total staff</span>
          <strong>{data.staff.length}</strong>
          <small>{data.staff.filter((member) => member.isActive).length} active</small>
        </div>
        <div className="mini-stat">
          <span>Teachers</span>
          <strong>{teachers.length}</strong>
          <small>teaching accounts</small>
        </div>
        <div className="mini-stat info">
          <span>Administrators</span>
          <strong>{admins.length}</strong>
          <small>SuperAdmin + SubAdmin</small>
        </div>
        <div className="mini-stat success">
          <span>Present today</span>
          <strong>{presentToday}</strong>
          <small>of {data.staff.length} staff</small>
        </div>
        <div className="mini-stat warning">
          <span>No software access</span>
          <strong>{support.length}</strong>
          <small>operational staff</small>
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
              placeholder="Search by name, email, department or staff ID"
            />
          </div>
          <div className="table-toolbar-filters">
            <select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)}>
              <option value="all">All access levels</option>
              {ACCESS_LEVELS.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All staff types</option>
              {STAFF_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <span className="table-result-count">{filtered.length} staff</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Type</th>
                <th>Department</th>
                <th>Access level</th>
                <th>Today</th>
                <th>Account</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const attendance = attendanceFor(member.id);
                return (
                  <tr key={member.id}>
                    <td>
                      <button
                        type="button"
                        className="table-person"
                        onClick={() => setSearchParams({ staff: member.id })}
                      >
                        <Avatar name={member.name} size={34} photo={member.photo} />
                        <span>
                          <strong>{member.name}</strong>
                          <small>{member.email}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="table-stack">
                        <strong>{member.staffType}</strong>
                        <small>{member.code}</small>
                      </span>
                    </td>
                    <td>{member.department}</td>
                    <td>
                      <Badge tone={accessTone(member.accessLevel)}>{member.accessLevel}</Badge>
                    </td>
                    <td>
                      {attendance ? (
                        <Badge
                          tone={
                            attendance.status === 'Present'
                              ? 'success'
                              : attendance.status === 'On Leave'
                                ? 'info'
                                : 'danger'
                          }
                        >
                          {attendance.status}
                        </Badge>
                      ) : (
                        <span className="muted small">Not marked</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={member.isActive ? 'success' : 'neutral'} dot>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => setSearchParams({ staff: member.id })}
                          aria-label={`View ${member.name}`}
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => openEdit(member)}
                          aria-label={`Edit ${member.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="table-action danger"
                          onClick={() => setDeleteTarget(member)}
                          aria-label={`Delete ${member.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Users}
                      title="No staff match these filters"
                      message="Try a different access level or clear the search."
                      compact
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>One unified staff directory drives access, timetable and attendance.</span>
          <div>
            <Badge tone="brand">{data.staff.length} records</Badge>
          </div>
        </div>
      </section>

      <Drawer
        open={Boolean(selectedStaff)}
        title={selectedStaff?.name}
        subtitle={selectedStaff ? `${selectedStaff.staffType} · ${selectedStaff.code}` : ''}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete('staff');
          setSearchParams(next, { replace: true });
        }}
        width={480}
        footer={
          selectedStaff ? (
            <div className="drawer-footer-actions">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => openEdit(selectedStaff)}>
                <Pencil size={15} /> Edit access
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={() => setDeleteTarget(selectedStaff)}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          ) : null
        }
      >
        {selectedStaff ? (
          <StaffDetail
            staff={selectedStaff}
            attendance={attendanceFor(selectedStaff.id)}
            canEditPhoto={permissions.superAdmin || permissions.principal}
            onPhotoSaved={refresh}
            onEdit={() => openEdit(selectedStaff)}
          />
        ) : null}
      </Drawer>

      <Modal
        open={formOpen}
        title={editing ? 'Edit staff member' : 'Add a staff member'}
        subtitle={
          editing
            ? 'Access changes take effect immediately across the admin console.'
            : 'Staff sign-in credentials are provisioned when Firebase Authentication is connected.'
        }
        icon={editing ? Pencil : UserPlus}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        size="lg"
        footer={
          <div className="modal-actions">
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" form="staff-form" className="admin-btn admin-btn-primary" disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <ShieldCheck size={16} />}
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add staff member'}
            </button>
          </div>
        }
      >
        <form id="staff-form" className="admin-form-grid" onSubmit={submit}>
          <label className="admin-field admin-span-2">
            <span>Full name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="e.g. Ms. Hina Raza"
              required
            />
          </label>
          <label className="admin-field">
            <span>Email address</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              placeholder="name@nawazschool.edu"
              required
            />
          </label>
          <label className="admin-field">
            <span>Phone</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
              placeholder="+92 300 1234567"
            />
          </label>
          <label className="admin-field">
            <span>Staff type</span>
            <select value={form.staffType} onChange={(event) => setField('staffType', event.target.value)}>
              {STAFF_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Department</span>
            <input
              type="text"
              value={form.department}
              onChange={(event) => setField('department', event.target.value)}
              placeholder="e.g. Science & Mathematics"
            />
          </label>
          <label className="admin-field">
            <span>Access level</span>
            <select value={form.accessLevel} onChange={(event) => setField('accessLevel', event.target.value)}>
              {ACCESS_LEVELS.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Joining date</span>
            <input
              type="date"
              value={form.joinedOn}
              onChange={(event) => setField('joinedOn', event.target.value)}
            />
          </label>
          <label className="admin-toggle admin-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
            <span className="admin-toggle-track" />
            <span>
              <strong>Active account</strong>
              <small>Inactive staff remain in records but cannot sign in.</small>
            </span>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Remove staff member?"
        subtitle="Timetable and subject references must be reassigned first."
        icon={Trash2}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDeleteTarget(null)}>
              Keep staff
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={remove} disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <Trash2 size={15} />}
              {busy ? 'Removing…' : 'Remove staff'}
            </button>
          </div>
        }
      >
        {deleteTarget ? (
          <div className="delete-summary">
            <Avatar name={deleteTarget.name} size={46} photo={deleteTarget.photo} />
            <div>
              <strong>{deleteTarget.name}</strong>
              <span>{deleteTarget.staffType} · {deleteTarget.email}</span>
              <p>
                If this person is referenced by a timetable or subject, deactivate the account
                instead.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function StaffDetail({ staff, attendance, onEdit, onPhotoSaved, canEditPhoto }) {
  return (
    <div className="staff-detail">
      <div className="staff-detail-hero">
        <PhotoPicker
          kind="staff"
          id={staff.id}
          name={staff.name}
          photo={staff.photo}
          size={70}
          onSaved={onPhotoSaved}
          readOnly={!canEditPhoto}
        />
        <div>
          <h2>{staff.name}</h2>
          <p>{staff.department}</p>
          <div className="student-detail-badges">
            <Badge tone={accessTone(staff.accessLevel)}>{staff.accessLevel}</Badge>
            <Badge tone={staff.isActive ? 'success' : 'neutral'} dot>
              {staff.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="staff-detail-grid">
        <div>
          <span>Staff ID</span>
          <strong>{staff.code}</strong>
        </div>
        <div>
          <span>Staff type</span>
          <strong>{staff.staffType}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{staff.email}</strong>
        </div>
        <div>
          <span>Phone</span>
          <strong>{staff.phone || 'Not recorded'}</strong>
        </div>
        <div>
          <span>Joined</span>
          <strong>{formatDate(staff.joinedOn)}</strong>
        </div>
        <div>
          <span>Today’s attendance</span>
          <strong>{attendance?.status || 'Not marked'}</strong>
        </div>
      </div>

      <div className="staff-detail-permission">
        <ShieldCheck size={17} />
        <div>
          <strong>{staff.accessLevel} access</strong>
          <p>
            {staff.accessLevel === 'SuperAdmin'
              ? 'Full administration, staff access, school settings and confidential requests.'
              : staff.accessLevel === 'SubAdmin'
                ? 'Academic and operational oversight without staff access or the confidential vault.'
                : staff.accessLevel === 'TeacherApp'
                  ? 'Teacher mobile workspace only: attendance, marks, syllabus and requests.'
                  : 'Appears in staff records and attendance, but cannot sign in.'}
          </p>
        </div>
      </div>

      {attendance?.checkInTime ? (
        <div className="staff-attendance-detail">
          <CalendarCheck2 size={16} />
          <div>
            <strong>Checked in {attendance.checkInTime}</strong>
            <span>
              {attendance.checkOutTime ? `Checked out ${attendance.checkOutTime}` : 'Still on duty'} ·{' '}
              {formatDate(attendance.date)}
            </span>
          </div>
        </div>
      ) : null}

      <button type="button" className="admin-btn admin-btn-secondary admin-btn-block" onClick={onEdit}>
        <Pencil size={15} /> Edit staff access
      </button>
    </div>
  );
}
