import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpenCheck,
  CalendarCheck2,
  ClipboardList,
  Inbox,
  Megaphone,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from './Avatar';
import Badge from './Badge';

export default function SearchOverlay({ open, onClose }) {
  const { data } = useAppData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    const handleKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return null;
    const students = data.students
      .filter(
        (student) =>
          student.name.toLowerCase().includes(text) ||
          student.code.toLowerCase().includes(text) ||
          student.rollNumber.includes(text) ||
          student.classIdSection.toLowerCase().includes(text)
      )
      .slice(0, 5);
    const staff = data.staff
      .filter(
        (member) =>
          member.name.toLowerCase().includes(text) ||
          member.email.toLowerCase().includes(text) ||
          member.department.toLowerCase().includes(text)
      )
      .slice(0, 4);
    const announcements = data.announcements
      .filter(
        (notice) =>
          notice.title.toLowerCase().includes(text) ||
          notice.body.toLowerCase().includes(text)
      )
      .slice(0, 3);
    const requests = data.rmsTickets
      .filter(
        (ticket) =>
          ticket.subject.toLowerCase().includes(text) ||
          ticket.senderName.toLowerCase().includes(text)
      )
      .slice(0, 3);
    return { students, staff, announcements, requests };
  }, [data, query]);

  const total =
    (results?.students.length || 0) +
    (results?.staff.length || 0) +
    (results?.announcements.length || 0) +
    (results?.requests.length || 0);

  if (!open) return null;

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return createPortal(
    <div
      className="search-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Search the school">
        <div className="search-panel-input">
          <Search size={20} />
          <input
            ref={inputRef}
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a student, teacher, notice or request…"
            aria-label="Search"
          />
          <button type="button" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="search-panel-body">
          {!query.trim() ? (
            <div className="search-quick">
              <span className="search-section-title">Quick destinations</span>
              <div className="search-quick-grid">
                <button type="button" onClick={() => go('/students')}>
                  <Users size={17} /> Students
                </button>
                <button type="button" onClick={() => go('/attendance')}>
                  <CalendarCheck2 size={17} /> Attendance
                </button>
                <button type="button" onClick={() => go('/classes')}>
                  <BookOpenCheck size={17} /> Classes
                </button>
                <button type="button" onClick={() => go('/requests')}>
                  <Inbox size={17} /> Requests
                </button>
                <button type="button" onClick={() => go('/assignments')}>
                  <ClipboardList size={17} /> Assignments
                </button>
                <button type="button" onClick={() => go('/announcements')}>
                  <Megaphone size={17} /> Announcements
                </button>
              </div>
              <p className="search-hint">
                Tip: start typing to search across all school records.
              </p>
            </div>
          ) : total === 0 ? (
            <div className="search-empty">
              <span>
                <Search size={20} />
              </span>
              <strong>No matches for “{query}”</strong>
              <p>Try a name, roll number, class, email or notice title.</p>
            </div>
          ) : (
            <>
              {results.students.length ? (
                <div className="search-group">
                  <span className="search-section-title">Students</span>
                  {results.students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="search-result"
                      onClick={() => go(`/students?student=${student.id}`)}
                    >
                      <Avatar name={student.name} size={32} photo={student.photo} />
                      <span>
                        <strong>{student.name}</strong>
                        <small>
                          {student.classIdSection} · Roll {student.rollNumber} · {student.code}
                        </small>
                      </span>
                      <Badge tone="neutral">{student.classIdSection}</Badge>
                    </button>
                  ))}
                </div>
              ) : null}

              {results.staff.length ? (
                <div className="search-group">
                  <span className="search-section-title">Staff</span>
                  {results.staff.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="search-result"
                      onClick={() => go(`/staff?staff=${member.id}`)}
                    >
                      <Avatar name={member.name} size={32} photo={member.photo} />
                      <span>
                        <strong>{member.name}</strong>
                        <small>
                          {member.department} · {member.email}
                        </small>
                      </span>
                      <Badge tone="info">{member.accessLevel}</Badge>
                    </button>
                  ))}
                </div>
              ) : null}

              {results.announcements.length ? (
                <div className="search-group">
                  <span className="search-section-title">Announcements</span>
                  {results.announcements.map((notice) => (
                    <button
                      key={notice.id}
                      type="button"
                      className="search-result"
                      onClick={() => go('/announcements')}
                    >
                      <span className="search-result-icon">
                        <Bell size={16} />
                      </span>
                      <span>
                        <strong>{notice.title}</strong>
                        <small>{notice.publisherName} · {notice.importance}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {results.requests.length ? (
                <div className="search-group">
                  <span className="search-section-title">Requests</span>
                  {results.requests.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className="search-result"
                      onClick={() => go('/requests')}
                    >
                      <span className="search-result-icon">
                        <Inbox size={16} />
                      </span>
                      <span>
                        <strong>{ticket.subject}</strong>
                        <small>
                          {ticket.senderName} · {ticket.ticketNo}
                        </small>
                      </span>
                      <Badge tone="neutral">{ticket.ticketNo}</Badge>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="search-panel-foot">
          <span>
            <kbd>Esc</kbd> to close
          </span>
          <span>{total ? `${total} results` : 'Search across the whole school'}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
