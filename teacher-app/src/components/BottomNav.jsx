import { NavLink } from 'react-router-dom';
import { CalendarCheck2, ClipboardList, House, LayoutGrid, Users } from 'lucide-react';

const ITEMS = [
  { to: '/', end: true, label: 'Home', icon: House },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck2 },
  { to: '/classes', label: 'Classes', icon: Users },
  { to: '/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/more', label: 'More', icon: LayoutGrid },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {ITEMS.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">
            <Icon size={21} strokeWidth={2.1} />
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
