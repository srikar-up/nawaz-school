import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Download,
  FileBarChart2,
  GraduationCap,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  Monitor,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHead from '../components/PageHead';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { formatDate } from '../lib/format';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || (import.meta.env.PROD ? '/admin/' : 'http://localhost:5174/');

export default function More() {
  const { data, user, session, logout, notify } = useAppData();
  const { canInstall, install } = useInstallPrompt();
  const teacherClasses = data.classes.filter((cls) => {
    const incharge = data.classIncharges.some(
      (entry) => entry.classIdSection === cls.id && entry.activeStaffId === user.id
    );
    const subject = data.subjects.some(
      (entry) => entry.classIdSection === cls.id && entry.assignedStaffId === user.id
    );
    return incharge || subject;
  });
  const myRequests = data.rmsTickets.filter(
    (ticket) => ticket.senderStaffId === user.id && ticket.status === 'pending'
  );
  const activeStaff = data.staff.filter((member) => member.isActive);

  const handleInstall = async () => {
    if (!canInstall) {
      notify('Use your browser menu → “Install app” to add Nawaz Teacher to this device.', 'info');
      return;
    }
    const accepted = await install();
    notify(accepted ? 'Nawaz Teacher installed on this device.' : 'Installation dismissed.', accepted ? 'success' : 'info');
  };

  return (
    <div className="t-page">
      <PageHead eyebrow="Workspace" title="More" subtitle="Everything else, kept out of your way." />

      <Link to="/profile" className="profile-summary-card">
        <Avatar name={user.name} size={54} photo={user.photo} />
        <div>
          <h2>{user.name}</h2>
          <p>{user.department}</p>
          <div className="profile-summary-badges">
            <Badge tone="brand" icon={ShieldCheck}>
              Faculty
            </Badge>
            <span>{session?.user?.email}</span>
          </div>
        </div>
        <ChevronRight size={19} />
      </Link>

      <div className="school-summary-strip">
        <span>
          <GraduationCap size={16} /> {data.meta.schoolName}
        </span>
        <span>{data.meta.academicYear}</span>
      </div>

      <section className="menu-group">
        <span className="menu-group-title">Teaching tools</span>
        <div className="menu-card">
          <Link to="/timetable" className="menu-row">
            <span className="menu-icon blue">
              <CalendarDays size={18} />
            </span>
            <span>
              <strong>Weekly timetable</strong>
              <small>Every period, class and room</small>
            </span>
            <ChevronRight size={17} />
          </Link>
          <Link to="/syllabus" className="menu-row">
            <span className="menu-icon teal">
              <BookOpen size={18} />
            </span>
            <span>
              <strong>Syllabus progress</strong>
              <small>Track chapters and completion</small>
            </span>
            <ChevronRight size={17} />
          </Link>
          <Link to="/reports" className="menu-row">
            <span className="menu-icon amber">
              <FileBarChart2 size={18} />
            </span>
            <span>
              <strong>Student reports</strong>
              <small>Attendance, scores and parent slips</small>
            </span>
            <ChevronRight size={17} />
          </Link>
          <Link to="/classes" className="menu-row">
            <span className="menu-icon indigo">
              <Users size={18} />
            </span>
            <span>
              <strong>My classes</strong>
              <small>{teacherClasses.length} sections in your workspace</small>
            </span>
            <ChevronRight size={17} />
          </Link>
        </div>
      </section>

      <section className="menu-group">
        <span className="menu-group-title">School</span>
        <div className="menu-card">
          <Link to="/staff" className="menu-row">
            <span className="menu-icon indigo">
              <UsersRound size={18} />
            </span>
            <span>
              <strong>School directory</strong>
              <small>{activeStaff.length} teachers, office and support staff</small>
            </span>
            <ChevronRight size={17} />
          </Link>
          <Link to="/requests" className="menu-row">
            <span className="menu-icon rose">
              <MessageSquareText size={18} />
            </span>
            <span>
              <strong>My requests</strong>
              <small>
                {myRequests.length ? `${myRequests.length} waiting for review` : 'Leave, repairs and private notes'}
              </small>
            </span>
            <ChevronRight size={17} />
          </Link>
          <Link to="/notices" className="menu-row">
            <span className="menu-icon orange">
              <Megaphone size={18} />
            </span>
            <span>
              <strong>Notice board</strong>
              <small>{data.announcements.length} school announcements</small>
            </span>
            <ChevronRight size={17} />
          </Link>
          <a className="menu-row" href={`mailto:${data.meta.email}`}>
            <span className="menu-icon gray">
              <CircleHelp size={18} />
            </span>
            <span>
              <strong>Help &amp; support</strong>
              <small>Contact the school office</small>
            </span>
            <ArrowUpRight size={17} />
          </a>
        </div>
      </section>

      <section className="menu-group">
        <span className="menu-group-title">App</span>
        <div className="menu-card">
          <button type="button" className="menu-row" onClick={handleInstall}>
            <span className="menu-icon green">
              <Download size={18} />
            </span>
            <span>
              <strong>Install teacher app</strong>
              <small>{canInstall ? 'Add to your home screen' : 'Available from your browser menu'}</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <a className="menu-row" href={ADMIN_URL} target="_blank" rel="noreferrer">
            <span className="menu-icon slate">
              <Monitor size={18} />
            </span>
            <span>
              <strong>Open admin console</strong>
              <small>A separate desktop workspace</small>
            </span>
            <ArrowUpRight size={17} />
          </a>
          <Link to="/profile" className="menu-row">
            <span className="menu-icon gray">
              <UserRound size={18} />
            </span>
            <span>
              <strong>Profile &amp; preferences</strong>
              <small>Contact details and app settings</small>
            </span>
            <ChevronRight size={17} />
          </Link>
        </div>
      </section>

      <div className="more-footer">
        <div className="more-footer-card">
          <span className="more-footer-icon">
            <ClipboardList size={20} />
          </span>
          <div>
            <strong>Nawaz Teacher</strong>
            <span>Prototype 1.0 · local school cache</span>
          </div>
        </div>
        <button type="button" className="btn btn-ghost signout-link" onClick={logout}>
          <LogOut size={16} /> Sign out
        </button>
        <p>
          {data.meta.schoolName} · {data.meta.academicYear} · {data.meta.phone}
        </p>
      </div>
    </div>
  );
}
