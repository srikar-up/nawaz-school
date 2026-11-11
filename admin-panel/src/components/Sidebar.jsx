import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Database,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Monitor,
  Settings,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from './Avatar';
import BrandMark from './BrandMark';

const TEACHER_URL = import.meta.env.VITE_TEACHER_URL || (import.meta.env.PROD ? '/teacher/' : 'http://localhost:5173/');

export default function Sidebar({ open, onClose }) {
  const { data, user, permissions } = useAppData();
  const location = useLocation();
  const pendingRequests = data.rmsTickets.filter(
    (ticket) => ticket.status === 'pending'
  ).length;

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const groups = [
    {
      title: 'Workspace',
      items: [
        { to: '/overview', label: 'Overview', icon: LayoutDashboard },
        { to: '/attendance', label: 'Attendance', icon: CalendarCheck2 },
        { to: '/students', label: 'Students', icon: Users },
        ...(permissions.superAdmin
          ? [{ to: '/staff', label: 'Staff & access', icon: GraduationCap }]
          : []),
        { to: '/classes', label: 'Classes & subjects', icon: BookOpenCheck },
        { to: '/timetable', label: 'Timetable', icon: CalendarDays },
        { to: '/exams', label: 'Exams & marks', icon: ClipboardCheck },
        { to: '/assignments', label: 'Assignments', icon: ClipboardList },
      ],
    },
    {
      title: 'Communication',
      items: [
        { to: '/announcements', label: 'Announcements', icon: Megaphone },
        {
          to: '/requests',
          label: 'Requests & leave',
          icon: Inbox,
          badge: pendingRequests,
        },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: '/reports', label: 'Reports', icon: BarChart3 },
        { to: '/data', label: 'Data exchange', icon: Database },
      ],
    },
  ];

  return (
    <>
      {open ? <div className="sidebar-scrim" onClick={onClose} /> : null}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <BrandMark subtitle="Admin console" />
        </div>

        <div className="sidebar-school">
          <span className="school-emblem">
            <GraduationCap size={17} />
          </span>
          <div>
            <strong>{data.meta.shortName || data.meta.schoolName}</strong>
            <span>{data.meta.academicYear}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {groups.map((group) => (
            <div key={group.title} className="sidebar-group">
              <span className="sidebar-group-label">{group.title}</span>
              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="sidebar-link-icon">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span>{label}</span>
                  {badge ? <span className="sidebar-badge">{badge}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-link-icon">
              <Settings size={18} />
            </span>
            <span>Settings</span>
          </NavLink>
          <a className="sidebar-link" href={TEACHER_URL} target="_blank" rel="noreferrer">
            <span className="sidebar-link-icon">
              <Monitor size={18} />
            </span>
            <span>Teacher app</span>
            <span className="sidebar-external">↗</span>
          </a>

          <NavLink to="/settings" className="sidebar-user">
            <Avatar name={user?.name} size={38} photo={user?.photo} />
            <span>
              <strong>{user?.name}</strong>
              <small>{user?.accessLevel}</small>
            </span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
