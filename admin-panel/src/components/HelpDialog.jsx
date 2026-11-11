import { CalendarCheck2, LifeBuoy, Megaphone, Search, Users } from 'lucide-react';
import Modal from './Modal';

const GUIDES = [
  {
    icon: CalendarCheck2,
    title: 'Mark the daily attendance',
    text: 'Open Attendance, choose the date, review each class, then save the register.',
  },
  {
    icon: Users,
    title: 'Add or find a student',
    text: 'Open Students to search the roster. Use “Add student” to create a new record.',
  },
  {
    icon: Megaphone,
    title: 'Send a message to the school',
    text: 'Open Announcements, write the message, choose who should see it, then send it.',
  },
  {
    icon: Search,
    title: 'Read or print a report',
    text: 'Open Reports for attendance, grades and students who need help. Print or download from there.',
  },
];

export default function HelpDialog({ open, onClose, meta }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Help and quick guides"
      subtitle="Short steps for the jobs you do most."
      icon={LifeBuoy}
      size="md"
    >
      <div className="help-list">
        {GUIDES.map(({ icon: Icon, title, text }) => (
          <div className="help-item" key={title}>
            <span className="help-icon">
              <Icon size={18} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="help-contact">
        <strong>Still stuck?</strong>
        <p>The school office can help with anything you cannot find here.</p>
        <div className="help-contact-links">
          {meta?.phone ? <a href={`tel:${meta.phone}`}>{meta.phone}</a> : null}
          {meta?.email ? <a href={`mailto:${meta.email}`}>{meta.email}</a> : null}
        </div>
      </div>
    </Modal>
  );
}
