import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  GraduationCap,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHead from '../components/PageHead';
import PhotoPicker from '../components/PhotoPicker';
import Sheet from '../components/Sheet';
import {
  formatDate,
  getTeacherClasses,
  getSubjectsForTeacher,
  relativeTime,
} from '../lib/format';

const PREFS_KEY = 'nawaz.teacher.preferences.v1';

export default function Profile() {
  const { data, user, logout, live, offline, lastSyncedAt, refresh } = useAppData();
  const classes = getTeacherClasses(data, user.id);
  const subjects = getSubjectsForTeacher(data, user.id);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [prefs, setPrefs] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(PREFS_KEY)) || {
          announcements: true,
          reminders: true,
        }
      );
    } catch {
      return { announcements: true, reminders: true };
    }
  });

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const toggle = (key) => setPrefs((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="t-page">
      <PageHead backTo="/more" eyebrow="Faculty profile" title="Profile" />

      <section className="profile-hero">
        <PhotoPicker
          kind="staff"
          id={user.id}
          name={user.name}
          photo={user.photo}
          size={76}
          onSaved={refresh}
        />
        <div>
          <h2>{user.name}</h2>
          <p>{user.department}</p>
          <div className="profile-hero-badges">
            <Badge tone="brand" icon={ShieldCheck}>
              Verified faculty
            </Badge>
            <Badge tone="neutral">{user.code}</Badge>
          </div>
        </div>
      </section>

      <div className="profile-contact-grid">
        <a href={`mailto:${user.email}`} className="profile-contact">
          <Mail size={16} />
          <span>
            <small>Email</small>
            <strong>{user.email}</strong>
          </span>
        </a>
        <a href={`tel:${user.phone}`} className="profile-contact">
          <Phone size={16} />
          <span>
            <small>Phone</small>
            <strong>{user.phone || 'Not recorded'}</strong>
          </span>
        </a>
      </div>

      <section className="card profile-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Teaching load</span>
            <h2>Assigned classes</h2>
          </div>
          <Badge tone="brand">{classes.length}</Badge>
        </div>
        <div className="profile-class-list">
          {classes.map((cls) => (
            <Link key={cls.id} to={`/classes/${cls.id}`} className="profile-class-row">
              <span className="profile-class-icon">
                <GraduationCap size={18} />
              </span>
              <span>
                <strong>{cls.displayName}</strong>
                <small>
                  {cls.room} · {cls.mySubjects.length} subjects
                </small>
              </span>
              <ChevronRight size={16} />
            </Link>
          ))}
        </div>
      </section>

      <section className="card profile-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">School record</span>
            <h2>Faculty details</h2>
          </div>
        </div>
        <div className="detail-list">
          <div>
            <span>Staff ID</span>
            <strong>{user.code}</strong>
          </div>
          <div>
            <span>Department</span>
            <strong>{user.department}</strong>
          </div>
          <div>
            <span>Joined</span>
            <strong>{formatDate(user.joinedOn)}</strong>
          </div>
          <div>
            <span>Subjects</span>
            <strong>{subjects.length} assigned</strong>
          </div>
        </div>
      </section>

      <section className="card profile-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">On this device</span>
            <h2>Preferences</h2>
          </div>
          <span className="muted small">Saved locally</span>
        </div>
        <div className="preference-list">
          <label className="preference-row">
            <span className="preference-icon amber">
              <BellRing size={17} />
            </span>
            <span>
              <strong>Announcement alerts</strong>
              <small>Highlight urgent school notices</small>
            </span>
            <input
              type="checkbox"
              checked={prefs.announcements}
              onChange={() => toggle('announcements')}
              aria-label="Announcement alerts"
            />
            <span className="switch" aria-hidden="true" />
          </label>
          <label className="preference-row">
            <span className="preference-icon indigo">
              <Clock3 size={17} />
            </span>
            <span>
              <strong>Attendance reminder</strong>
              <small>Remember the daily register</small>
            </span>
            <input
              type="checkbox"
              checked={prefs.reminders}
              onChange={() => toggle('reminders')}
              aria-label="Attendance reminder"
            />
            <span className="switch" aria-hidden="true" />
          </label>
        </div>
        <p className="preference-note">
          These preferences are stored on this device. Push delivery will switch on when the
          Firebase backend is connected.
        </p>
      </section>

      <section className="card profile-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Connection</span>
            <h2>Sync status</h2>
          </div>
          {offline ? (
            <Badge tone="danger" icon={WifiOff}>
              Offline
            </Badge>
          ) : live ? (
            <Badge tone="success" icon={Wifi}>
              Live
            </Badge>
          ) : (
            <Badge tone="warning" icon={Cloud}>
              Reconnecting
            </Badge>
          )}
        </div>
        <div className="sync-detail">
          <div>
            <span>Data source</span>
            <strong>Local school cache</strong>
          </div>
          <div>
            <span>Last sync</span>
            <strong>{lastSyncedAt ? relativeTime(lastSyncedAt.toISOString()) : 'Not yet'}</strong>
          </div>
          <div>
            <span>Records loaded</span>
            <strong>
              {data.students.length} students · {data.classes.length} classes
            </strong>
          </div>
        </div>
        <p className="preference-note">
          The temporary Node cache keeps both apps in sync. The same screens will use Firebase
          Firestore once it is connected.
        </p>
      </section>

      <button type="button" className="btn btn-danger-ghost btn-block" onClick={() => setSignOutOpen(true)}>
        <LogOut size={17} /> Sign out
      </button>

      <p className="profile-footer">
        <UserRound size={13} /> Nawaz Teacher · Prototype 1.0 · Data resets from the admin settings.
      </p>

      <Sheet
        open={signOutOpen}
        title="Sign out?"
        subtitle="Your saved preferences stay on this device."
        onClose={() => setSignOutOpen(false)}
        footer={
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setSignOutOpen(false)}>
              Stay signed in
            </button>
            <button type="button" className="btn btn-danger" onClick={logout}>
              Sign out
            </button>
          </div>
        }
      >
        <div className="confirm-summary">
          <span className="confirm-icon">
            <LogOut size={24} />
          </span>
          <h3>{user.name}</h3>
          <p>You will need your school email and password to sign back in.</p>
          <div className="status-note">
            <CheckCircle2 size={15} /> Any attendance or marks already submitted are safe.
          </div>
        </div>
      </Sheet>
    </div>
  );
}
