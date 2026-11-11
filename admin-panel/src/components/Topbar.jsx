import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarCheck2,
  ChevronDown,
  HelpCircle,
  Inbox,
  Menu,
  Megaphone,
  Search,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from './Avatar';
import HelpDialog from './HelpDialog';
import {
  examEffectiveStatus,
  isStudentAtRisk,
  relativeTime,
  todayISO,
} from '../lib/format';
import { attendanceModeOf, primarySessionType } from '../lib/attendance';

const TITLES = {
  '/overview': 'Overview',
  '/attendance': 'Attendance',
  '/students': 'Students',
  '/staff': 'Staff & access',
  '/classes': 'Classes & subjects',
  '/curriculum': 'Curriculum',
  '/exams': 'Exams & marks',
  '/assignments': 'Assignments',
  '/announcements': 'Announcements',
  '/requests': 'Requests & leave',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export default function Topbar({ onMenu, onSearch }) {
  const { data, user, live, offline, permissions } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const title = TITLES[location.pathname] || 'Overview';
  const pendingRequests = data.rmsTickets.filter(
    (ticket) => ticket.status === 'pending'
  );
  const urgentNotices = data.announcements.filter(
    (notice) => notice.importance === 'Urgent' || notice.importance === 'Emergency'
  );
  const atRisk = data.students.filter((student) => isStudentAtRisk(data, student.id));
  const waitingClasses = data.classes.filter(
    (cls) =>
      !data.attendanceSessions.some(
        (session) =>
          session.classIdSection === cls.id &&
          session.date === todayISO() &&
          session.sessionType === primarySessionType(attendanceModeOf(data.meta))
      )
  );
  const openExamCount = data.exams.filter(
    (exam) => examEffectiveStatus(exam) === 'Open'
  ).length;
  const attentionCount =
    pendingRequests.length + urgentNotices.length + waitingClasses.length;

  const notifications = useMemo(
    () => [
      {
        icon: Inbox,
        tone: 'amber',
        title: `${pendingRequests.length} request${pendingRequests.length === 1 ? '' : 's'} waiting`,
        detail: pendingRequests[0]
          ? `${pendingRequests[0].senderName} · ${pendingRequests[0].subject}`
          : 'Everything is reviewed',
        to: '/requests',
      },
      {
        icon: CalendarCheck2,
        tone: 'indigo',
        title: `${waitingClasses.length} class${waitingClasses.length === 1 ? '' : 'es'} without attendance`,
        detail: waitingClasses.map((cls) => cls.displayName).join(', ') || 'All registers submitted',
        to: '/attendance',
      },
      {
        icon: TriangleAlert,
        tone: 'rose',
        title: `${atRisk.length} students need attention`,
        detail: 'Below the 35% assessment risk threshold',
        to: '/reports',
      },
      {
        icon: Megaphone,
        tone: 'teal',
        title: `${urgentNotices.length} urgent notice${urgentNotices.length === 1 ? '' : 's'}`,
        detail: urgentNotices[0]?.title || 'No urgent broadcasts',
        to: '/announcements',
      },
    ],
    [pendingRequests, waitingClasses, atRisk.length, urgentNotices]
  );

  return (
    <header className="topbar">
      <button type="button" className="topbar-menu" onClick={onMenu} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <div className="topbar-breadcrumb">
        <span>Dashboard</span>
        <i>/</i>
        <strong>{title}</strong>
        {openExamCount ? <span className="topbar-context-pill">{openExamCount} exams open</span> : null}
      </div>

      <button type="button" className="topbar-search" onClick={onSearch}>
        <Search size={17} />
        <span>Search students, staff, notices…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-help"
          onClick={() => setHelpOpen(true)}
          aria-label="Open help and quick guides"
        >
          <HelpCircle size={16} />
          <span>Help</span>
        </button>

        <span className={`sync-chip ${offline ? 'offline' : live ? 'live' : 'warn'}`}>
          {offline ? <WifiOff size={13} /> : <Wifi size={13} />}
          <span>{offline ? 'Offline' : live ? 'Up to date' : 'Reconnecting'}</span>
        </span>

        <div className="topbar-bell-wrap">
          <button
            type="button"
            className={`topbar-bell ${notificationsOpen ? 'active' : ''}`}
            onClick={() => setNotificationsOpen((current) => !current)}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell size={19} />
            {attentionCount ? <span className="topbar-bell-badge">{attentionCount}</span> : null}
          </button>
          {notificationsOpen ? (
            <>
              <div className="popover-scrim" onClick={() => setNotificationsOpen(false)} />
              <div className="topbar-popover">
                <div className="topbar-popover-head">
                  <div>
                    <strong>Needs attention</strong>
                    <span>{attentionCount} items across the school</span>
                  </div>
                  <button type="button" className="icon-btn" onClick={() => setNotificationsOpen(false)}>
                    <ChevronDown size={17} />
                  </button>
                </div>
                <div className="topbar-notifications">
                  {notifications.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.title}
                        to={item.to}
                        className="notification-row"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <span className={`notification-icon ${item.tone}`}>
                          <Icon size={17} />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <div className="topbar-popover-foot">
                  <Link to="/requests" onClick={() => setNotificationsOpen(false)}>
                    Open request desk
                  </Link>
                  <span>{relativeTime(new Date().toISOString())}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <button type="button" className="topbar-user" onClick={() => navigate('/settings')}>
          <Avatar name={user?.name} size={36} photo={user?.photo} />
          <span className="topbar-user-text">
            <strong>{user?.name}</strong>
            <small>{user?.accessLevel}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        {permissions.subAdmin ? <span className="topbar-role-flag">Ops</span> : null}
      </div>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} meta={data.meta} />
    </header>
  );
}
