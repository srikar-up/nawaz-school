import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CloudDownload,
  Database,
  Download,
  ExternalLink,
  LogOut,
  MonitorDown,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import PhotoPicker from '../components/PhotoPicker';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { attendanceModeOf } from '../lib/attendance';
import {
  downloadCsv,
  downloadJson,
  formatDate,
  relativeTime,
  studentAverage,
  todayISO,
} from '../lib/format';

const TEACHER_URL = import.meta.env.VITE_TEACHER_URL || (import.meta.env.PROD ? '/teacher/' : 'http://localhost:5173/');

export default function Settings() {
  const {
    data,
    user,
    permissions,
    live,
    offline,
    lastSyncedAt,
    refreshing,
    refresh,
    logout,
    notify,
  } = useAppData();
  const { canInstall, install } = useInstallPrompt();
  const [form, setForm] = useState({
    schoolName: data.meta.schoolName,
    shortName: data.meta.shortName,
    tagline: data.meta.tagline,
    academicYear: data.meta.academicYear,
    address: data.meta.address,
    phone: data.meta.phone,
    email: data.meta.email,
    principalName: data.meta.principalName,
  });
  const [busy, setBusy] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState(() => attendanceModeOf(data.meta));
  const savedModeRef = useRef(attendanceModeOf(data.meta));
  const [modeBusy, setModeBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    setForm({
      schoolName: data.meta.schoolName,
      shortName: data.meta.shortName,
      tagline: data.meta.tagline,
      academicYear: data.meta.academicYear,
      address: data.meta.address,
      phone: data.meta.phone,
      email: data.meta.email,
      principalName: data.meta.principalName,
    });
  }, [data.meta]);

  // Only reset the radio when the saved mode itself changes, so a background
  // refresh cannot discard an unsaved selection.
  useEffect(() => {
    const saved = attendanceModeOf(data.meta);
    if (saved !== savedModeRef.current) {
      savedModeRef.current = saved;
      setAttendanceMode(saved);
    }
  }, [data.meta]);

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.updateMeta(user.id, form);
      await refresh({ silent: true });
      notify('School profile updated across both apps.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveAttendanceMode = async () => {
    setModeBusy(true);
    try {
      await api.updateMeta(user.id, { attendanceMode });
      await refresh({ silent: true });
      notify(
        attendanceMode === 'fullDay'
          ? 'Attendance mode saved: one full-day register.'
          : 'Attendance mode saved: morning and afternoon registers.',
        'success'
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setModeBusy(false);
    }
  };

  const resetDemo = async () => {
    setBusy(true);
    try {
      await api.resetDemo(user.id);
      await refresh({ silent: true });
      setResetOpen(false);
      notify('Demo database restored to its original seed.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const backupJson = () => {
    downloadJson(`nawaz-school-backup-${todayISO()}.json`, data);
    notify('Full data backup downloaded.', 'success');
  };

  const exportStudents = () => {
    downloadCsv(
      `nawaz-students-${todayISO()}.csv`,
      ['student_id', 'roll_number', 'name', 'class', 'guardian', 'phone', 'attendance', 'average'],
      data.students.map((student) => {
        const sessions = data.attendanceSessions.filter((session) =>
          session.entries.some((entry) => entry.studentId === student.id)
        );
        const present = sessions.filter((session) =>
          session.entries.some(
            (entry) => entry.studentId === student.id && entry.status === 'present'
          )
        ).length;
        return [
          student.code,
          student.rollNumber,
          student.name,
          student.classIdSection,
          student.guardianName || '',
          student.parentPhone || '',
          sessions.length ? Math.round((present / sessions.length) * 1000) / 10 : 0,
          studentAverage(data, student.id) ?? '',
        ];
      })
    );
    notify('Student roster downloaded.', 'success');
  };

  const handleInstall = async () => {
    if (!canInstall) {
      notify('Use your browser menu → “Install app” to add the admin console.', 'info');
      return;
    }
    const accepted = await install();
    notify(accepted ? 'Admin console installed.' : 'Installation dismissed.', accepted ? 'success' : 'info');
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="School & account"
        title="Settings"
        subtitle="School identity, administrator account, local data and prototype controls."
      />

      <div className="settings-layout">
        <section className="admin-card school-profile-card">
          <div className="admin-card-head">
            <div>
              <h2>School profile</h2>
              <p>Shown in both the admin console and teacher workspace.</p>
            </div>
            <span className="settings-icon">
              <Building2 size={19} />
            </span>
          </div>

          {!permissions.superAdmin ? (
            <div className="settings-warning">
              <ShieldCheck size={16} />
              Only a SuperAdmin can change school settings. You can review the current values.
            </div>
          ) : null}

          <form className="admin-form-grid" onSubmit={save}>
            <label className="admin-field">
              <span>School name</span>
              <input
                type="text"
                value={form.schoolName}
                onChange={(event) => setField('schoolName', event.target.value)}
                disabled={!permissions.superAdmin}
                required
              />
            </label>
            <label className="admin-field">
              <span>Short name</span>
              <input
                type="text"
                value={form.shortName}
                onChange={(event) => setField('shortName', event.target.value)}
                disabled={!permissions.superAdmin}
              />
            </label>
            <label className="admin-field">
              <span>Tagline</span>
              <input
                type="text"
                value={form.tagline}
                onChange={(event) => setField('tagline', event.target.value)}
                disabled={!permissions.superAdmin}
              />
            </label>
            <label className="admin-field">
              <span>Academic year</span>
              <input
                type="text"
                value={form.academicYear}
                onChange={(event) => setField('academicYear', event.target.value)}
                disabled={!permissions.superAdmin}
              />
            </label>
            <label className="admin-field">
              <span>Principal</span>
              <input
                type="text"
                value={form.principalName}
                onChange={(event) => setField('principalName', event.target.value)}
                disabled={!permissions.superAdmin}
              />
            </label>
            <label className="admin-field">
              <span>Office phone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
                disabled={!permissions.superAdmin}
              />
            </label>
            <label className="admin-field admin-span-2">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                disabled={!permissions.superAdmin}
              />
            </label>
            <label className="admin-field admin-span-2">
              <span>Address</span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
                disabled={!permissions.superAdmin}
              />
            </label>
            <div className="admin-form-actions admin-span-2">
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={busy || !permissions.superAdmin}
              >
                {busy ? <span className="admin-spinner" /> : <Save size={16} />}
                {busy ? 'Saving…' : 'Save school profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card attendance-mode-card">
          <div className="admin-card-head">
            <div>
              <h2>Attendance mode</h2>
              <p>How teachers record the daily register.</p>
            </div>
            <span className="settings-icon">
              <CalendarCheck2 size={19} />
            </span>
          </div>

          {!permissions.superAdmin ? (
            <div className="settings-warning">
              <ShieldCheck size={16} />
              Only a SuperAdmin can change the attendance mode.
            </div>
          ) : null}

          <div className="attendance-mode-options" role="radiogroup" aria-label="Attendance mode">
            <label
              className={`attendance-mode-option ${
                attendanceMode === 'twoSessions' ? 'active' : ''
              }`}
            >
              <input
                type="radio"
                name="attendanceMode"
                value="twoSessions"
                checked={attendanceMode === 'twoSessions'}
                onChange={() => setAttendanceMode('twoSessions')}
                disabled={!permissions.superAdmin}
              />
              <span>
                <strong>Morning + afternoon</strong>
                <small>Two registers a day. Each half is marked separately.</small>
              </span>
            </label>
            <label
              className={`attendance-mode-option ${
                attendanceMode === 'fullDay' ? 'active' : ''
              }`}
            >
              <input
                type="radio"
                name="attendanceMode"
                value="fullDay"
                checked={attendanceMode === 'fullDay'}
                onChange={() => setAttendanceMode('fullDay')}
                disabled={!permissions.superAdmin}
              />
              <span>
                <strong>One full-day register</strong>
                <small>A single roll-call covers the whole day.</small>
              </span>
            </label>
          </div>

          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={saveAttendanceMode}
              disabled={
                modeBusy ||
                !permissions.superAdmin ||
                attendanceMode === attendanceModeOf(data.meta)
              }
            >
              {modeBusy ? <span className="admin-spinner" /> : <Save size={16} />}
              {modeBusy ? 'Saving…' : 'Save attendance mode'}
            </button>
          </div>
        </section>

        <aside className="settings-aside">
          <section className="admin-card account-card">
            <div className="admin-card-head">
              <div>
                <h2>Administrator</h2>
                <p>Signed in to the local prototype</p>
              </div>
              <Badge tone={permissions.superAdmin ? 'brand' : 'info'}>
                {user.accessLevel}
              </Badge>
            </div>
            <div className="account-profile">
              <PhotoPicker
                kind="staff"
                id={user.id}
                name={user.name}
                photo={user.photo}
                size={58}
                onSaved={refresh}
              />
              <div>
                <strong>{user.name}</strong>
                <span>{user.staffType} · {user.department}</span>
                <small>{user.email}</small>
              </div>
            </div>
            <div className="account-meta">
              <div>
                <span>Staff ID</span>
                <strong>{user.code}</strong>
              </div>
              <div>
                <span>Joined</span>
                <strong>{formatDate(user.joinedOn)}</strong>
              </div>
              <div>
                <span>Session</span>
                <strong>{offline ? 'Offline' : live ? 'Live' : 'Reconnecting'}</strong>
              </div>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-danger-ghost admin-btn-block"
              onClick={() => setSignOutOpen(true)}
            >
              <LogOut size={16} /> Sign out
            </button>
          </section>

          <section className="admin-card connection-card">
            <div className="admin-card-head">
              <div>
                <h2>School records</h2>
                <p>Where the admin console reads and saves data</p>
              </div>
              {offline ? <WifiOff size={18} className="danger-text" /> : <Wifi size={18} className="success-text" />}
            </div>
            <div className="connection-status">
              <span className={`connection-dot ${offline ? 'offline' : 'online'}`} />
              <div>
                <strong>{offline ? 'Working offline' : 'Records are up to date'}</strong>
                <span>
                  {lastSyncedAt
                    ? `Checked ${relativeTime(lastSyncedAt.toISOString())}`
                    : 'Checking the school records'}
                </span>
              </div>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => refresh()}
                disabled={refreshing}
                aria-label="Refresh data"
              >
                <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
              </button>
            </div>
            <div className="connection-stats">
              <div>
                <span>Students</span>
                <strong>{data.students.length}</strong>
              </div>
              <div>
                <span>Attendance sessions</span>
                <strong>{data.attendanceSessions.length}</strong>
              </div>
              <div>
                <span>Score records</span>
                <strong>{data.testRecords.length}</strong>
              </div>
            </div>
            <p className="settings-note">
              The Node JSON service keeps both PWAs in sync. The API layer is isolated so Firebase
              can replace it later without changing these screens.
            </p>
          </section>

          <section className="admin-card settings-actions-card">
            <div className="admin-card-head">
              <div>
                <h2>Data &amp; app</h2>
                <p>Backups and installed experiences</p>
              </div>
              <Database size={18} className="muted-icon" />
            </div>
            <button type="button" className="settings-action" onClick={backupJson}>
              <span className="settings-action-icon indigo">
                <CloudDownload size={17} />
              </span>
              <span>
                <strong>Download full backup</strong>
                <small>All school data as JSON</small>
              </span>
              <Download size={15} />
            </button>
            <button type="button" className="settings-action" onClick={exportStudents}>
              <span className="settings-action-icon teal">
                <UsersIcon />
              </span>
              <span>
                <strong>Export student roster</strong>
                <small>CSV for spreadsheet use</small>
              </span>
              <Download size={15} />
            </button>
            <Link to="/data" className="settings-action">
              <span className="settings-action-icon indigo">
                <Database size={17} />
              </span>
              <span>
                <strong>Import / export all data</strong>
                <small>Full CSV bundle with validation</small>
              </span>
              <Download size={15} />
            </Link>
            <button type="button" className="settings-action" onClick={handleInstall}>
              <span className="settings-action-icon amber">
                <MonitorDown size={17} />
              </span>
              <span>
                <strong>Install admin console</strong>
                <small>{canInstall ? 'Add to this device' : 'Available from the browser menu'}</small>
              </span>
              <ExternalLink size={15} />
            </button>
            <a className="settings-action" href={TEACHER_URL} target="_blank" rel="noreferrer">
              <span className="settings-action-icon rose">
                <Smartphone size={17} />
              </span>
              <span>
                <strong>Open teacher workspace</strong>
                <small>The mobile PWA runs separately</small>
              </span>
              <ExternalLink size={15} />
            </a>
          </section>

          <section className="admin-card danger-zone">
            <div className="admin-card-head">
              <div>
                <h2>Prototype reset</h2>
                <p>Restore demo data</p>
              </div>
              <AlertTriangle size={18} className="danger-text" />
            </div>
            <p>
              Resetting clears every change made in both apps and reseeds the original students,
              staff, attendance, exams and notices.
            </p>
            <button
              type="button"
              className="admin-btn admin-btn-danger-ghost admin-btn-block"
              onClick={() => setResetOpen(true)}
              disabled={!permissions.superAdmin}
            >
              <Trash2 size={16} /> Reset demo database
            </button>
          </section>
        </aside>
      </div>

      <Modal
        open={resetOpen}
        title="Reset the demo database?"
        subtitle="Every change in both apps will be replaced with the original seed."
        icon={AlertTriangle}
        onClose={() => setResetOpen(false)}
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={resetDemo} disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <Trash2 size={15} />}
              {busy ? 'Resetting…' : 'Reset all data'}
            </button>
          </div>
        }
      >
        <div className="reset-summary">
          <p>
            This will remove any attendance, marks, students, announcements and requests created
            during the demo, then reseed the database from today.
          </p>
          <div className="status-note admin-status-note">
            <CheckCircle2 size={15} />
            The teacher and admin apps will refresh automatically through live sync.
          </div>
        </div>
      </Modal>

      <Modal
        open={signOutOpen}
        title="Sign out of the admin console?"
        subtitle="The teacher app session is separate."
        icon={LogOut}
        onClose={() => setSignOutOpen(false)}
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setSignOutOpen(false)}>
              Stay signed in
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={logout}>
              Sign out
            </button>
          </div>
        }
      >
        <div className="reset-summary">
          <p>You will need your administrator email and password to sign back in.</p>
        </div>
      </Modal>
    </div>
  );
}

function UsersIcon() {
  return <UserRound size={17} />;
}
