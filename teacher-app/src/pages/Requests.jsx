import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardPlus,
  Clock3,
  FileLock2,
  Hammer,
  LockKeyhole,
  MessageSquareText,
  Package,
  Plus,
  Send,
  ShieldCheck,
  Stethoscope,
  Wrench,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import Sheet from '../components/Sheet';
import {
  formatDate,
  relativeTime,
  rmsMeta,
  rmsStatusMeta,
} from '../lib/format';

const CATEGORIES = [
  {
    value: 'leave',
    label: 'Leave',
    description: 'Sick, casual or emergency leave',
    icon: Stethoscope,
    tone: 'amber',
  },
  {
    value: 'maintenance',
    label: 'Maintenance',
    description: 'A room or facility needs repair',
    icon: Wrench,
    tone: 'rose',
  },
  {
    value: 'gear',
    label: 'Equipment',
    description: 'Lab gear, supplies or classroom items',
    icon: Package,
    tone: 'teal',
  },
  {
    value: 'confidential',
    label: 'Confidential',
    description: 'A private note for the principal only',
    icon: LockKeyhole,
    tone: 'indigo',
  },
];

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'leave', label: 'Leave' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'confidential', label: 'Confidential' },
];

const leaveTypes = ['Sick leave', 'Casual leave', 'Emergency leave', 'Medical leave'];

export default function Requests() {
  const { data, user, notify, refresh } = useAppData();
  const [tab, setTab] = useState('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: 'leave',
    leaveType: 'Sick leave',
    duration: '1 day',
    subject: '',
    details: '',
    room: '',
    priority: 'Medium',
  });

  const tickets = data.rmsTickets
    .filter((ticket) => ticket.senderStaffId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const counts = {
    all: tickets.length,
    leave: tickets.filter((ticket) => ticket.category === 'leave').length,
    maintenance: tickets.filter(
      (ticket) => ticket.category === 'maintenance' || ticket.category === 'gear'
    ).length,
    confidential: tickets.filter((ticket) => ticket.isConfidential).length,
  };
  const visible = tickets.filter((ticket) => {
    if (tab === 'all') return true;
    if (tab === 'maintenance') return ['maintenance', 'gear'].includes(ticket.category);
    if (tab === 'confidential') return ticket.isConfidential;
    return ticket.category === tab;
  });
  const selectedTicket = selected
    ? tickets.find((ticket) => ticket.id === selected)
    : null;

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const compose = (category) => {
    setForm({
      category,
      leaveType: 'Sick leave',
      duration: '1 day',
      subject: '',
      details: '',
      room: '',
      priority: 'Medium',
    });
    setComposeOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const subject =
        form.subject.trim() ||
        (form.category === 'leave'
          ? `${form.leaveType} request`
          : form.category === 'maintenance'
            ? 'Maintenance request'
            : 'New request');
      const body =
        form.category === 'leave'
          ? `${form.leaveType} · ${form.duration}\n\n${form.details}`
          : form.details;
      await api.createRequest(user.id, {
        category: form.category,
        subject,
        body,
        room: form.room,
        priority: form.priority,
      });
      await refresh({ silent: true });
      setComposeOpen(false);
      setTab('all');
      notify('Request sent to the school office.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const categoryIcon = {
    leave: Stethoscope,
    maintenance: Wrench,
    gear: Package,
    confidential: LockKeyhole,
    general: MessageSquareText,
  };

  return (
    <div className="t-page">
      <PageHead
        backTo="/more"
        eyebrow="Private request desk"
        title="Requests"
        subtitle="Leave, maintenance, equipment and confidential notes — straight to the principal."
        action={
          <button type="button" className="icon-btn" onClick={() => compose('leave')} aria-label="New request">
            <Plus size={20} />
          </button>
        }
      />

      <div className="category-shortcuts">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.value}
              type="button"
              className={`category-shortcut tone-${category.tone}`}
              onClick={() => compose(category.value)}
            >
              <span className="category-icon">
                <Icon size={19} />
              </span>
              <strong>{category.label}</strong>
              <small>{category.description}</small>
            </button>
          );
        })}
      </div>

      <div className="filter-pills">
        {TABS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className={tab === entry.value ? 'active' : ''}
            onClick={() => setTab(entry.value)}
          >
            {entry.label} <span>{counts[entry.value]}</span>
          </button>
        ))}
      </div>

      <div className="ticket-list">
        {visible.map((ticket) => {
          const meta = rmsMeta(ticket.category);
          const status = rmsStatusMeta(ticket.status);
          const Icon = categoryIcon[ticket.category] || MessageSquareText;
          return (
            <button
              key={ticket.id}
              type="button"
              className="ticket-card"
              onClick={() => setSelected(ticket.id)}
            >
              <span className={`ticket-icon ${ticket.isConfidential ? 'private' : ''}`}>
                <Icon size={18} />
              </span>
              <span className="ticket-main">
                <span className="ticket-top">
                  <span className="eyebrow">{meta.label}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </span>
                <strong>{ticket.subject}</strong>
                <small>
                  {ticket.ticketNo} · {relativeTime(ticket.createdAt)}
                  {ticket.room ? ` · ${ticket.room}` : ''}
                </small>
                {ticket.principalNote ? (
                  <span className="ticket-note">
                    <MessageSquareText size={12} /> {ticket.principalNote}
                  </span>
                ) : null}
              </span>
              <ChevronRight size={17} className="ticket-chevron" />
            </button>
          );
        })}
        {!visible.length ? (
          <EmptyState
            icon={ClipboardPlus}
            title="No requests in this view"
            message="Start a new request and it will appear here with its live status."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => compose('leave')}>
                <Plus size={15} /> New request
              </button>
            }
          />
        ) : null}
      </div>

      <div className="info-strip neutral">
        <ShieldCheck size={17} />
        <span>
          Confidential notes are visible only to the principal. The admin sees your name on all
          other requests so they can reply.
        </span>
      </div>

      <Sheet
        open={Boolean(selectedTicket)}
        title={selectedTicket?.subject}
        subtitle={
          selectedTicket
            ? `${selectedTicket.ticketNo} · ${rmsMeta(selectedTicket.category).label}`
            : ''
        }
        onClose={() => setSelected(null)}
      >
        {selectedTicket ? (
          <div className="ticket-detail">
            <div className="ticket-detail-status">
              <Badge tone={rmsStatusMeta(selectedTicket.status).tone}>
                {rmsStatusMeta(selectedTicket.status).label}
              </Badge>
              <span>
                <Clock3 size={14} /> Submitted {formatDate(selectedTicket.createdAt.slice(0, 10))}
              </span>
            </div>
            <p className="ticket-detail-body">{selectedTicket.body}</p>
            {selectedTicket.room ? (
              <div className="detail-list compact">
                <div>
                  <span>Location</span>
                  <strong>{selectedTicket.room}</strong>
                </div>
                <div>
                  <span>Priority</span>
                  <strong>{selectedTicket.priority}</strong>
                </div>
              </div>
            ) : null}
            {selectedTicket.principalNote ? (
              <div className="principal-note">
                <span>
                  <ShieldCheck size={15} /> Principal’s note
                </span>
                <p>{selectedTicket.principalNote}</p>
              </div>
            ) : (
              <div className="status-note">
                <Clock3 size={15} /> Waiting for the school office to review this request.
              </div>
            )}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={composeOpen}
        title="New request"
        subtitle="Choose the desk that should receive it."
        onClose={() => setComposeOpen(false)}
        size="large"
        footer={
          <button type="submit" form="request-form" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <span className="btn-spinner" /> : <Send size={17} />}
            {busy ? 'Sending…' : 'Send request'}
          </button>
        }
      >
        <form id="request-form" className="form-stack" onSubmit={submit}>
          <div className="category-choice-grid">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.value}
                  type="button"
                  className={`category-choice ${form.category === category.value ? 'active' : ''}`}
                  onClick={() => setField('category', category.value)}
                >
                  <Icon size={18} />
                  <span>{category.label}</span>
                </button>
              );
            })}
          </div>

          {form.category === 'leave' ? (
            <div className="form-row">
              <label className="field">
                <span>Leave type</span>
                <select value={form.leaveType} onChange={(event) => setField('leaveType', event.target.value)}>
                  {leaveTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Duration</span>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(event) => setField('duration', event.target.value)}
                  placeholder="e.g. 2 days"
                />
              </label>
            </div>
          ) : null}

          <label className="field">
            <span>Subject</span>
            <input
              type="text"
              value={form.subject}
              onChange={(event) => setField('subject', event.target.value)}
              placeholder={
                form.category === 'confidential'
                  ? 'A short private subject'
                  : 'Summarise the request'
              }
              required
            />
          </label>

          <label className="field">
            <span>{form.category === 'leave' ? 'Reason & handover plan' : 'Details'}</span>
            <textarea
              rows={4}
              value={form.details}
              onChange={(event) => setField('details', event.target.value)}
              placeholder={
                form.category === 'maintenance'
                  ? 'Describe what is broken and how it affects classes.'
                  : form.category === 'gear'
                    ? 'List the items and quantity you need.'
                    : 'Add the details the principal needs to act.'
              }
              required
            />
          </label>

          {form.category === 'maintenance' || form.category === 'gear' ? (
            <div className="form-row">
              <label className="field">
                <span>{form.category === 'gear' ? 'Lab / department' : 'Room'}</span>
                <input
                  type="text"
                  value={form.room}
                  onChange={(event) => setField('room', event.target.value)}
                  placeholder={form.category === 'gear' ? 'e.g. Computer Lab' : 'e.g. Room 204'}
                />
              </label>
              <label className="field">
                <span>Priority</span>
                <select value={form.priority} onChange={(event) => setField('priority', event.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
            </div>
          ) : null}

          {form.category === 'confidential' ? (
            <div className="private-callout">
              <FileLock2 size={18} />
              <span>
                <strong>Private by design</strong>
                Only the principal can open this note. It does not appear in general admin queues.
              </span>
            </div>
          ) : null}
        </form>
      </Sheet>
    </div>
  );
}
