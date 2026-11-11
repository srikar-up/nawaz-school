import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Inbox,
  LockKeyhole,
  MessageSquareText,
  Search,
  ShieldCheck,
  Stethoscope,
  Wrench,
  X,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Drawer from '../components/Drawer';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import {
  formatDateTime,
  relativeTime,
  rmsCategoryMeta,
  rmsStatusMeta,
} from '../lib/format';

const STATUSES = [
  { value: 'pending', label: 'Pending review' },
  { value: 'underReview', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
  { value: 'resolved', label: 'Resolved' },
];

function categoryIcon(category) {
  if (category === 'leave') return Stethoscope;
  if (category === 'maintenance' || category === 'gear') return Wrench;
  if (category === 'confidential') return LockKeyhole;
  return MessageSquareText;
}

export default function Requests() {
  const { data, user, permissions, notify, refresh } = useAppData();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [draftStatus, setDraftStatus] = useState('pending');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const tickets = useMemo(
    () =>
      [...data.rmsTickets]
        .filter((ticket) => {
          if (ticket.isConfidential && !permissions.superAdmin) return false;
          if (tab === 'leave') return ticket.category === 'leave';
          if (tab === 'maintenance')
            return ticket.category === 'maintenance' || ticket.category === 'gear';
          if (tab === 'confidential') return ticket.isConfidential;
          return true;
        })
        .filter((ticket) => statusFilter === 'all' || ticket.status === statusFilter)
        .filter((ticket) => {
          const text = search.trim().toLowerCase();
          return (
            !text ||
            ticket.subject.toLowerCase().includes(text) ||
            ticket.body.toLowerCase().includes(text) ||
            ticket.senderName.toLowerCase().includes(text) ||
            ticket.ticketNo.toLowerCase().includes(text)
          );
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [data.rmsTickets, permissions.superAdmin, tab, statusFilter, search]
  );

  const selected = tickets.find((ticket) => ticket.id === selectedId) ||
    data.rmsTickets.find((ticket) => ticket.id === selectedId) ||
    null;

  useEffect(() => {
    if (!selected) return;
    setDraftStatus(selected.status);
    setNote(selected.principalNote || '');
  }, [selectedId]);

  const counts = {
    all: data.rmsTickets.filter((ticket) => permissions.superAdmin || !ticket.isConfidential).length,
    leave: data.rmsTickets.filter((ticket) => ticket.category === 'leave').length,
    maintenance: data.rmsTickets.filter((ticket) =>
      ['maintenance', 'gear'].includes(ticket.category)
    ).length,
    confidential: permissions.superAdmin
      ? data.rmsTickets.filter((ticket) => ticket.isConfidential).length
      : 0,
  };
  const pending = data.rmsTickets.filter((ticket) => ticket.status === 'pending').length;
  const underReview = data.rmsTickets.filter((ticket) => ticket.status === 'underReview').length;
  const resolved = data.rmsTickets.filter((ticket) =>
    ['approved', 'resolved', 'rejected'].includes(ticket.status)
  ).length;

  const save = async (nextStatus = draftStatus) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.updateRequest(user.id, selected.id, {
        status: nextStatus,
        principalNote: note,
      });
      await refresh({ silent: true });
      setDraftStatus(nextStatus);
      notify(`${selected.ticketNo} updated to ${rmsStatusMeta(nextStatus).label.toLowerCase()}.`, 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const quickAction = async (status) => {
    await save(status);
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Operations desk"
        title="Requests & leave"
        subtitle="Approve leave, route repairs and keep private staff notes in the principal vault."
      />

      <div className="mini-stat-row">
        <div className="mini-stat warning">
          <span>Pending review</span>
          <strong>{pending}</strong>
          <small>waiting for a decision</small>
        </div>
        <div className="mini-stat info">
          <span>Under review</span>
          <strong>{underReview}</strong>
          <small>assigned or being handled</small>
        </div>
        <div className="mini-stat success">
          <span>Closed</span>
          <strong>{resolved}</strong>
          <small>approved, resolved or declined</small>
        </div>
        <div className="mini-stat">
          <span>Confidential</span>
          <strong>{permissions.superAdmin ? counts.confidential : '—'}</strong>
          <small>{permissions.superAdmin ? 'principal vault only' : 'SuperAdmin only'}</small>
        </div>
      </div>

      <div className="admin-tabs">
        {[
          { value: 'all', label: 'All requests' },
          { value: 'leave', label: 'Leave desk' },
          { value: 'maintenance', label: 'Maintenance' },
          ...(permissions.superAdmin
            ? [{ value: 'confidential', label: 'Principal vault' }]
            : []),
        ].map((entry) => (
          <button
            key={entry.value}
            type="button"
            className={tab === entry.value ? 'active' : ''}
            onClick={() => setTab(entry.value)}
          >
            {entry.value === 'confidential' ? <LockKeyhole size={15} /> : null}
            {entry.label}
            <span className="tab-count">{counts[entry.value]}</span>
          </button>
        ))}
      </div>

      <section className="admin-card table-card">
        <div className="table-toolbar">
          <div className="admin-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by request, staff member or ticket number"
            />
          </div>
          <div className="table-toolbar-filters">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <span className="table-result-count">{tickets.length} requests</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>From</th>
                <th>Category</th>
                <th>Submitted</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const category = rmsCategoryMeta(ticket.category);
                const status = rmsStatusMeta(ticket.status);
                const Icon = categoryIcon(ticket.category);
                return (
                  <tr key={ticket.id} className={ticket.isConfidential ? 'confidential-row' : ''}>
                    <td>
                      <span className="table-request-cell">
                        <span className={`request-table-icon ${ticket.isConfidential ? 'private' : ''}`}>
                          <Icon size={16} />
                        </span>
                        <span>
                          <strong>{ticket.subject}</strong>
                          <small>
                            {ticket.ticketNo}
                            {ticket.isConfidential ? ' · private note' : ''}
                          </small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="table-person muted-person">
                        <Avatar
                          name={ticket.senderName}
                          size={28}
                          photo={data.staff.find((member) => member.id === ticket.senderStaffId)?.photo}
                        />
                        <span>
                          <strong>{ticket.senderName}</strong>
                          <small>{ticket.room || 'Staff request'}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <Badge tone={category.tone}>{category.short}</Badge>
                    </td>
                    <td>
                      <span className="table-stack">
                        <strong>{relativeTime(ticket.createdAt)}</strong>
                        <small>{formatDateTime(ticket.createdAt)}</small>
                      </span>
                    </td>
                    <td>{ticket.priority}</td>
                    <td>
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => setSelectedId(ticket.id)}
                          aria-label={`Review ${ticket.subject}`}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!tickets.length ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Inbox}
                      title="No requests in this view"
                      message="Requests raised by teachers will appear here."
                      compact
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>
            <ShieldCheck size={14} /> Confidential notes are visible only to the SuperAdmin.
          </span>
          <Badge tone="brand">{pending} pending</Badge>
        </div>
      </section>

      <Drawer
        open={Boolean(selected)}
        title={selected?.subject}
        subtitle={
          selected
            ? `${selected.ticketNo} · ${rmsCategoryMeta(selected.category).label}`
            : ''
        }
        onClose={() => setSelectedId('')}
        width={520}
        footer={
          selected ? (
            <div className="drawer-footer-actions">
              <span className="drawer-save-info">
                <span>Current status</span>
                <strong>{rmsStatusMeta(selected.status).label}</strong>
              </span>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => save()}
                disabled={busy}
              >
                {busy ? <span className="admin-spinner" /> : <Check size={16} />}
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="request-detail">
            {selected.isConfidential ? (
              <div className="vault-banner">
                <LockKeyhole size={18} />
                <div>
                  <strong>Principal vault</strong>
                  <span>This note is restricted to the SuperAdmin and was not shared with operators.</span>
                </div>
              </div>
            ) : null}

            <div className="request-detail-head">
              <div className="request-sender">
                <Avatar
                  name={selected.senderName}
                  size={46}
                  photo={data.staff.find((member) => member.id === selected.senderStaffId)?.photo}
                />
                <div>
                  <strong>{selected.senderName}</strong>
                  <span>{selected.senderEmail}</span>
                </div>
              </div>
              <Badge tone={rmsCategoryMeta(selected.category).tone}>
                {rmsCategoryMeta(selected.category).short}
              </Badge>
            </div>

            <div className="request-meta-grid">
              <div>
                <span>Submitted</span>
                <strong>{formatDateTime(selected.createdAt)}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>{selected.priority}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{selected.room || 'Not specified'}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{rmsStatusMeta(selected.status).label}</strong>
              </div>
            </div>

            <div className="request-message">
              <span className="request-message-label">Request details</span>
              <p>{selected.body}</p>
            </div>

            <div className="request-quick-actions">
              {selected.category === 'leave' ? (
                <>
                  <button type="button" className="admin-btn admin-btn-success" onClick={() => quickAction('approved')} disabled={busy}>
                    <CheckCircle2 size={15} /> Approve leave
                  </button>
                  <button type="button" className="admin-btn admin-btn-danger-ghost" onClick={() => quickAction('rejected')} disabled={busy}>
                    <X size={15} /> Decline
                  </button>
                </>
              ) : null}
              {['maintenance', 'gear'].includes(selected.category) ? (
                <>
                  <button type="button" className="admin-btn admin-btn-success" onClick={() => quickAction('resolved')} disabled={busy}>
                    <CheckCircle2 size={15} /> Mark resolved
                  </button>
                  <button type="button" className="admin-btn admin-btn-secondary" onClick={() => quickAction('underReview')} disabled={busy}>
                    <Clock3 size={15} /> Assign work order
                  </button>
                </>
              ) : null}
              {selected.status === 'pending' && !['leave', 'maintenance', 'gear'].includes(selected.category) ? (
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => quickAction('underReview')} disabled={busy}>
                  <Clock3 size={15} /> Mark under review
                </button>
              ) : null}
            </div>

            <label className="admin-field">
              <span>Status</span>
              <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Principal’s note</span>
              <textarea
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a short reply or instruction. The teacher will see this note."
              />
            </label>

            <div className="request-timeline">
              <span className="timeline-label">History</span>
              <div className="request-timeline-row">
                <span className="timeline-dot" />
                <div>
                  <strong>Submitted by {selected.senderName}</strong>
                  <small>{formatDateTime(selected.createdAt)}</small>
                </div>
              </div>
              {selected.resolvedAt ? (
                <div className="request-timeline-row">
                  <span className="timeline-dot green" />
                  <div>
                    <strong>{rmsStatusMeta(selected.status).label}</strong>
                    <small>{formatDateTime(selected.resolvedAt)}</small>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
