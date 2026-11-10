import { useMemo, useRef, useState } from 'react';
import {
  Megaphone,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import {
  formatDateTime,
  importanceTone,
  relativeTime,
} from '../lib/format';

const AUDIENCES = [
  { value: 'All', label: 'Everyone' },
  { value: 'TeachersOnly', label: 'Teachers only' },
  { value: 'StudentsOnly', label: 'Students only' },
  { value: 'Class10', label: 'Grade 10 families' },
  { value: 'Class9', label: 'Grade 9 families' },
];
const IMPORTANCE = ['Normal', 'Important', 'Urgent', 'Emergency'];

export default function Announcements() {
  const { data, user, notify, refresh } = useAppData();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [importance, setImportance] = useState('Normal');
  const [audience, setAudience] = useState('All');
  const [isPinned, setIsPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pinningId, setPinningId] = useState(null);
  const titleRef = useRef(null);

  const notices = useMemo(
    () =>
      [...data.announcements]
        .filter((notice) => {
          const text = search.trim().toLowerCase();
          const matchesSearch =
            !text ||
            notice.title.toLowerCase().includes(text) ||
            notice.body.toLowerCase().includes(text) ||
            notice.publisherName.toLowerCase().includes(text);
          const matchesFilter = filter === 'All' || notice.importance === filter;
          return matchesSearch && matchesFilter;
        })
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        }),
    [data.announcements, search, filter]
  );

  const publish = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createAnnouncement(user.id, {
        title,
        body,
        importance,
        audience,
        isPinned,
      });
      await refresh({ silent: true });
      setTitle('');
      setBody('');
      setImportance('Normal');
      setAudience('All');
      setIsPinned(false);
      notify('Announcement published to the teacher workspace.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (notice) => {
    setPinningId(notice.id);
    try {
      await api.updateAnnouncement(user.id, notice.id, { isPinned: !notice.isPinned });
      await refresh({ silent: true });
      notify(notice.isPinned ? 'Announcement unpinned.' : 'Announcement pinned.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setPinningId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteAnnouncement(user.id, deleteTarget.id);
      await refresh({ silent: true });
      notify('Announcement deleted.', 'success');
      setDeleteTarget(null);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const focusComposer = () => {
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="School communication"
        title="Announcements"
        subtitle="Publish clear updates to the right audience and keep urgent notices visible."
        actions={
          <button type="button" className="admin-btn admin-btn-primary" onClick={focusComposer}>
            <Plus size={16} /> New announcement
          </button>
        }
      />

      <div className="announcements-layout">
        <section className="admin-card composer-card">
          <div className="admin-card-head">
            <div>
              <h2>Compose announcement</h2>
              <p>Sent to the teacher workspace immediately.</p>
            </div>
            <span className="composer-icon">
              <Megaphone size={19} />
            </span>
          </div>

          <form className="composer-form" onSubmit={publish}>
            <label className="admin-field">
              <span>Headline</span>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Parent–teacher meeting this Saturday"
                maxLength={110}
                required
              />
              <small className="field-counter">{title.length}/110</small>
            </label>

            <label className="admin-field">
              <span>Message</span>
              <textarea
                rows={5}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write the details in plain language. Include dates, times and what people should do."
                required
              />
            </label>

            <div className="admin-field">
              <span>Audience</span>
              <div className="composer-options">
                {AUDIENCES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`composer-option ${audience === option.value ? 'active' : ''}`}
                    onClick={() => setAudience(option.value)}
                  >
                    <Users size={13} /> {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-field">
              <span>Priority</span>
              <div className="composer-options">
                {IMPORTANCE.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`composer-option priority-${importanceTone(level)} ${
                      importance === level ? 'active' : ''
                    }`}
                    onClick={() => {
                      setImportance(level);
                      if (level === 'Urgent' || level === 'Emergency') setIsPinned(true);
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(event) => setIsPinned(event.target.checked)}
              />
              <span className="admin-toggle-track" />
              <span>
                <strong>Pin to the top</strong>
                <small>Urgent and emergency notices are pinned automatically.</small>
              </span>
            </label>

            <div className="composer-preview">
              <span>Signed by</span>
              <strong>{user.name}</strong>
            </div>

            <button type="submit" className="admin-btn admin-btn-primary admin-btn-block" disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <Send size={16} />}
              {busy ? 'Publishing…' : 'Publish announcement'}
            </button>
          </form>
        </section>

        <section className="announcements-feed">
          <div className="announcements-feed-toolbar">
            <div className="admin-search">
              <Search size={17} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search announcements"
                aria-label="Search announcements"
              />
            </div>
            <div className="filter-chip-row">
              {['All', ...IMPORTANCE].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={filter === level ? 'active' : ''}
                  onClick={() => setFilter(level)}
                >
                  {level}
                  <span>
                    {level === 'All'
                      ? data.announcements.length
                      : data.announcements.filter((notice) => notice.importance === level).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {notices.length ? (
            <div className="announcement-feed-list">
              {notices.map((notice) => (
                <article
                  key={notice.id}
                  className={`announcement-feed-card tone-${importanceTone(notice.importance)}`}
                >
                  <div className="announcement-feed-head">
                    <div className="announcement-feed-badges">
                      <Badge tone={importanceTone(notice.importance)}>{notice.importance}</Badge>
                      {notice.isPinned ? (
                        <Badge tone="neutral" icon={Pin}>
                          Pinned
                        </Badge>
                      ) : null}
                      <Badge tone="info">{notice.audience}</Badge>
                    </div>
                    <span>{relativeTime(notice.createdAt)}</span>
                  </div>
                  <h3>{notice.title}</h3>
                  <p>{notice.body}</p>
                  <div className="announcement-feed-foot">
                    <span>
                      <Sparkles size={13} /> Published by {notice.publisherName}
                    </span>
                    <span>{formatDateTime(notice.createdAt)}</span>
                    <div className="announcement-feed-actions">
                      <button
                        type="button"
                        className="admin-text-button"
                        onClick={() => togglePin(notice)}
                        disabled={pinningId === notice.id}
                      >
                        {notice.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                        {notice.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        className="admin-text-button danger"
                        onClick={() => setDeleteTarget(notice)}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Megaphone}
              title="No announcements in this view"
              message="Change the filter or publish a new school update."
            />
          )}
        </section>
      </div>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete announcement?"
        subtitle="It will disappear from the teacher notice board."
        icon={Trash2}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDeleteTarget(null)}>
              Keep announcement
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={remove} disabled={busy}>
              {busy ? <span className="admin-spinner" /> : <Trash2 size={15} />}
              {busy ? 'Deleting…' : 'Delete announcement'}
            </button>
          </div>
        }
      >
        {deleteTarget ? (
          <div className="delete-summary">
            <span className="delete-icon">
              <Megaphone size={24} />
            </span>
            <div>
              <strong>{deleteTarget.title}</strong>
              <span>{deleteTarget.importance} · {deleteTarget.audience}</span>
              <p>This cannot be undone in the prototype.</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
