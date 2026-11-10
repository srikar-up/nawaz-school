import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  Clock3,
  GraduationCap,
  LockKeyhole,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { formatDate, formatTime, timeToMinutes, todayISO } from '../lib/format';
import {
  getTimetableConfig,
  isTimeRangeValid,
  timetableDayLabel,
  upcomingSundayISO,
  weekDatesForDays,
} from '../lib/timetable';

const SUBJECT_TONES = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3' },
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
  { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6' },
];

function validatePeriodForm(periods) {
  for (const period of periods) {
    if (!isTimeRangeValid(period.startTime, period.endTime)) {
      return `Period ${period.periodNumber} needs a valid start and end time.`;
    }
  }
  for (let i = 0; i < periods.length; i += 1) {
    for (let j = i + 1; j < periods.length; j += 1) {
      const a = periods[i];
      const b = periods[j];
      if (
        timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
        timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
      ) {
        return `Period ${a.periodNumber} overlaps period ${b.periodNumber}.`;
      }
    }
  }
  return '';
}

export default function Timetable() {
  const { data, user, notify, refresh } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialClass = searchParams.get('class');
  const [classId, setClassId] = useState(
    data.classes.some((cls) => cls.id === initialClass)
      ? initialClass
      : data.classes[0]?.id || ''
  );
  const [editingCell, setEditingCell] = useState(null);
  const [cellForm, setCellForm] = useState({
    subjectId: '',
    teacherStaffId: '',
    room: '',
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    days: [],
    periods: [],
    editUntil: upcomingSundayISO(),
  });
  const [busy, setBusy] = useState(false);

  const config = useMemo(() => getTimetableConfig(data), [data]);
  const dayKey = config.days.join(',');
  const periodKey = config.periods
    .map((period) => `${period.periodNumber}:${period.startTime}-${period.endTime}`)
    .join('|');
  const dates = useMemo(
    () => weekDatesForDays(config.days),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayKey]
  );
  const selectedClass =
    data.classes.find((cls) => cls.id === classId) || data.classes[0];
  const subjects = useMemo(
    () =>
      data.subjects.filter(
        (subject) => subject.classIdSection === selectedClass?.id
      ),
    [data.subjects, selectedClass?.id]
  );
  const teachers = useMemo(
    () =>
      data.staff.filter(
        (member) =>
          member.isActive &&
          ['Teacher', 'Principal', 'Vice Principal', 'Coordinator'].includes(
            member.staffType
          )
      ),
    [data.staff]
  );
  const subjectToneMap = useMemo(
    () =>
      Object.fromEntries(
        subjects.map((subject, index) => [
          subject.id,
          SUBJECT_TONES[index % SUBJECT_TONES.length],
        ])
      ),
    [subjects]
  );
  const scheduleMap = useMemo(() => {
    const map = new Map();
    data.timetable
      .filter((entry) => entry.classIdSection === selectedClass?.id)
      .forEach((entry) => {
        map.set(`${entry.dayOfWeek}-${entry.periodNumber}`, entry);
      });
    return map;
  }, [data.timetable, selectedClass?.id]);
  const weekEntries = useMemo(
    () =>
      data.timetable.filter(
        (entry) =>
          entry.classIdSection === selectedClass?.id &&
          config.days.includes(entry.dayOfWeek) &&
          config.periods.some((period) => period.periodNumber === entry.periodNumber)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.timetable, selectedClass?.id, dayKey, periodKey]
  );
  const capacity = config.days.length * config.periods.length;
  const teacherCount = new Set(weekEntries.map((entry) => entry.teacherStaffId)).size;
  const conflicts = useMemo(() => {
    const relevant = data.timetable.filter(
      (entry) =>
        config.days.includes(entry.dayOfWeek) &&
        config.periods.some((period) => period.periodNumber === entry.periodNumber)
    );
    const found = [];
    for (let i = 0; i < relevant.length; i += 1) {
      for (let j = i + 1; j < relevant.length; j += 1) {
        const a = relevant[i];
        const b = relevant[j];
        if (a.dayOfWeek !== b.dayOfWeek) continue;
        const overlap =
          timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
          timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
        if (!overlap) continue;
        if (a.classIdSection === b.classIdSection) {
          found.push({
            id: `${a.id}-${b.id}-class`,
            message: `${a.classIdSection} has overlapping periods at ${formatTime(a.startTime)}.`,
          });
        } else if (a.teacherStaffId === b.teacherStaffId) {
          found.push({
            id: `${a.id}-${b.id}-teacher`,
            message: `${a.teacherName} is in ${a.classIdSection} and ${b.classIdSection} at ${formatTime(a.startTime)}.`,
          });
        }
      }
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.timetable, dayKey, periodKey]);

  const editingOpen = config.isEditable;
  const editingLabel =
    config.status === 'published'
      ? 'Published · locked'
      : config.windowOpen
        ? `Draft · editable until ${formatDate(config.editUntil)}`
        : `Editing closed ${formatDate(config.editUntil)}`;

  const selectClass = (id) => {
    setClassId(id);
    setSearchParams({ class: id }, { replace: true });
  };

  const updateSettings = async (payload, successMessage) => {
    setBusy(true);
    try {
      await api.updateTimetableSettings(user.id, payload);
      await refresh({ silent: true });
      notify(successMessage, 'success');
      return true;
    } catch (error) {
      notify(error.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const publishTimetable = async () => {
    const ok = await updateSettings(
      {
        days: config.days,
        periods: config.periods,
        editUntil: config.editUntil,
        status: 'published',
      },
      'Timetable published. It is now read-only until you reopen editing.'
    );
    if (ok) setEditingCell(null);
  };

  const reopenTimetable = async () => {
    const nextSunday = upcomingSundayISO();
    const ok = await updateSettings(
      {
        days: config.days,
        periods: config.periods,
        editUntil: nextSunday > config.editUntil ? nextSunday : config.editUntil,
        status: 'draft',
      },
      config.windowOpen
        ? 'Timetable editing reopened.'
        : 'Editing reopened and extended to the next Sunday.'
    );
    if (ok) setEditingCell(null);
  };

  const openSettings = () => {
    setSettingsForm({
      days: [...config.days],
      periods: config.periods.map((period) => ({ ...period })),
      editUntil: config.editUntil,
    });
    setSettingsOpen(true);
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    if (!settingsForm.days.length) {
      notify('Choose at least one working day.', 'error');
      return;
    }
    const periodError = validatePeriodForm(settingsForm.periods);
    if (periodError) {
      notify(periodError, 'error');
      return;
    }
    const scheduleChanged =
      JSON.stringify(settingsForm.days) !== JSON.stringify(config.days) ||
      JSON.stringify(settingsForm.periods) !== JSON.stringify(config.periods);
    const status =
      config.status === 'published' && scheduleChanged ? 'draft' : config.status;
    const ok = await updateSettings(
      {
        days: settingsForm.days,
        periods: settingsForm.periods,
        editUntil: settingsForm.editUntil,
        status,
      },
      scheduleChanged
        ? 'Timetable settings saved. Existing slots were moved to the new time grid.'
        : 'Timetable editing window updated.'
    );
    if (ok) setSettingsOpen(false);
  };

  const openCell = (day, period, entry) => {
    if (!editingOpen) {
      notify(
        config.status === 'published'
          ? 'This timetable is published. Reopen editing first.'
          : `The editing window closed on ${formatDate(config.editUntil)}. Extend editing first.`,
        'info'
      );
      return;
    }
    const subject =
      subjects.find((item) => item.id === entry?.subjectId) || subjects[0];
    setCellForm({
      subjectId: subject?.id || '',
      teacherStaffId: entry?.teacherStaffId || subject?.assignedStaffId || '',
      room: entry?.room || '',
    });
    setEditingCell({ day, period, entry });
  };

  const onSubjectChange = (subjectId) => {
    const subject = subjects.find((item) => item.id === subjectId);
    setCellForm((current) => ({
      ...current,
      subjectId,
      teacherStaffId: subject?.assignedStaffId || current.teacherStaffId,
      room: current.room,
    }));
  };

  const saveCell = async () => {
    if (!editingCell) return;
    if (!cellForm.subjectId || !cellForm.teacherStaffId) {
      notify('Choose a subject and teacher for this slot.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.saveTimetableCell(user.id, {
        classIdSection: selectedClass.id,
        dayOfWeek: editingCell.day,
        periodNumber: editingCell.period.periodNumber,
        subjectId: cellForm.subjectId,
        teacherStaffId: cellForm.teacherStaffId,
        room: cellForm.room,
      });
      await refresh({ silent: true });
      setEditingCell(null);
      notify('Timetable slot saved.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeCell = async () => {
    if (!editingCell?.entry) return;
    setBusy(true);
    try {
      await api.deleteTimetableCell(user.id, editingCell.entry.id);
      await refresh({ silent: true });
      setEditingCell(null);
      notify('Timetable slot removed.', 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const setPeriodTime = (index, field, value) => {
    setSettingsForm((current) => ({
      ...current,
      periods: current.periods.map((period, periodIndex) =>
        periodIndex === index ? { ...period, [field]: value } : period
      ),
    }));
  };

  const addPeriod = () => {
    setSettingsForm((current) => {
      const last = current.periods[current.periods.length - 1];
      const nextNumber = current.periods.length + 1;
      const start = last?.endTime || '08:30';
      const endMinutes = Math.min(timeToMinutes(start) + 45, 23 * 60 + 59);
      const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      return {
        ...current,
        periods: [
          ...current.periods,
          { periodNumber: nextNumber, startTime: start, endTime: end },
        ],
      };
    });
  };

  const removePeriod = (index) => {
    setSettingsForm((current) => ({
      ...current,
      periods: current.periods
        .filter((_, periodIndex) => periodIndex !== index)
        .map((period, periodIndex) => ({ ...period, periodNumber: periodIndex + 1 })),
    }));
  };

  return (
    <div className="admin-page timetable-builder-page">
      <PageHeader
        eyebrow="Academic structure"
        title="Timetable builder"
        subtitle="Build the full school week, assign every period and keep the draft editable through Sunday."
        actions={
          <div className="timetable-head-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={openSettings}
            >
              <Settings2 size={16} /> Days &amp; periods
            </button>
            {config.status === 'published' || !config.windowOpen ? (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={reopenTimetable}
                disabled={busy}
              >
                {busy ? <span className="admin-spinner" /> : <Unlock size={16} />}
                {config.status === 'published' ? 'Reopen editing' : 'Extend to Sunday'}
              </button>
            ) : (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={publishTimetable}
                disabled={busy}
              >
                {busy ? <span className="admin-spinner" /> : <LockKeyhole size={16} />}
                Publish timetable
              </button>
            )}
          </div>
        }
      />

      {!editingOpen ? (
        <div className="settings-warning timetable-locked-warning">
          <LockKeyhole size={16} />
          <span>
            {config.status === 'published'
              ? 'This timetable is published and read-only. Reopen editing to make changes.'
              : `The editing window closed on ${formatDate(config.editUntil)}. Extend it to the next Sunday before editing.`}
          </span>
        </div>
      ) : null}

      <section className="admin-card timetable-control-card">
        <div className="timetable-class-picker">
          <span className="class-avatar">
            <GraduationCap size={22} />
          </span>
          <div>
            <span className="admin-eyebrow">Class timetable</span>
            <select
              value={selectedClass?.id || ''}
              onChange={(event) => selectClass(event.target.value)}
            >
              {data.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName} · {cls.room}
                </option>
              ))}
            </select>
          </div>
          <Badge tone={config.status === 'published' ? 'neutral' : 'success'} dot>
            {editingLabel}
          </Badge>
        </div>
        <div className="timetable-control-stats">
          <div>
            <span>Slots filled</span>
            <strong>{weekEntries.length}/{capacity}</strong>
            <small>{config.days.length} days · {config.periods.length} periods</small>
          </div>
          <div>
            <span>Teachers</span>
            <strong>{teacherCount}</strong>
            <small>assigned this week</small>
          </div>
          <div>
            <span>Free slots</span>
            <strong>{Math.max(0, capacity - weekEntries.length)}</strong>
            <small>available for planning</small>
          </div>
          <div>
            <span>Conflicts</span>
            <strong className={conflicts.length ? 'danger-text' : 'success-text'}>
              {conflicts.length}
            </strong>
            <small>{conflicts.length ? 'fix before publishing' : 'no clashes detected'}</small>
          </div>
        </div>
        <div className="timetable-edit-window">
          <CalendarClock size={15} />
          <span>
            {config.status === 'published'
              ? `Published ${config.publishedAt ? formatDate(config.publishedAt) : 'by the office'}. Students and teachers see this timetable.`
              : `Draft — keep editing through Sunday ${formatDate(config.editUntil)}. Publishing locks every slot until you reopen it.`}
          </span>
        </div>
      </section>

      {conflicts.length ? (
        <details className="timetable-conflict-panel">
          <summary>
            <AlertTriangle size={16} />
            {conflicts.length} timetable conflict{conflicts.length === 1 ? '' : 's'} detected
          </summary>
          <ul>
            {conflicts.slice(0, 12).map((conflict) => (
              <li key={conflict.id}>{conflict.message}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <section className="admin-card timetable-card timetable-builder-card">
        <div className="admin-card-head">
          <div>
            <h2>{selectedClass?.displayName} · full week</h2>
            <p>
              {editingOpen
                ? 'Click any slot to assign a subject, teacher and room.'
                : 'Read-only timetable. Reopen editing to make changes.'}
            </p>
          </div>
          <div className="timetable-head-meta">
            <Badge tone="brand">{selectedClass?.academicYear}</Badge>
            <span>
              <Clock3 size={14} /> {config.periods.length} periods per day
            </span>
          </div>
        </div>

        <div className="timetable-grid-wrap">
          <table className="timetable-grid timetable-editor-grid">
            <thead>
              <tr>
                <th className="timetable-corner">Period</th>
                {dates.map((day) => (
                  <th key={day.value} className={day.isToday ? 'today' : ''}>
                    <span>{day.label}</span>
                    <small>{day.date.getDate()} {day.date.toLocaleDateString('en-GB', { month: 'short' })}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.periods.map((period) => (
                <tr key={period.periodNumber}>
                  <th className="timetable-period-cell">
                    <strong>P{period.periodNumber}</strong>
                    <span>{formatTime(period.startTime)}</span>
                    <small>{formatTime(period.endTime)}</small>
                  </th>
                  {config.days.map((day) => {
                    const entry = scheduleMap.get(`${day}-${period.periodNumber}`);
                    const tone = entry ? subjectToneMap[entry.subjectId] : null;
                    const dayInfo = dates.find((item) => item.value === day);
                    return (
                      <td key={`${day}-${period.periodNumber}`} className={dayInfo?.isToday ? 'today' : ''}>
                        {entry ? (
                          <button
                            type="button"
                            className={`timetable-editor-cell ${editingOpen ? '' : 'locked'}`}
                            onClick={() => openCell(day, period, entry)}
                            style={{
                              background: tone?.bg,
                              borderColor: tone?.border,
                              color: tone?.text,
                            }}
                            title={`${entry.subject} · ${entry.teacherName} · ${entry.room}`}
                          >
                            <strong>{entry.subject}</strong>
                            <span>{entry.teacherName}</span>
                            <small>{entry.room}</small>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`timetable-empty-cell ${editingOpen ? '' : 'locked'}`}
                            onClick={() => openCell(day, period, null)}
                            disabled={!editingOpen}
                          >
                            {editingOpen ? (
                              <>
                                <Plus size={14} /> Add slot
                              </>
                            ) : (
                              'Free'
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="timetable-legend">
          {subjects.map((subject) => (
            <span key={subject.id}>
              <i
                style={{
                  background: subjectToneMap[subject.id]?.bg,
                  borderColor: subjectToneMap[subject.id]?.border,
                }}
              />
              {subject.subjectName}
            </span>
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(editingCell)}
        title={
          editingCell
            ? `${timetableDayLabel(editingCell.day)} · Period ${editingCell.period.periodNumber}`
            : 'Timetable slot'
        }
        subtitle={
          selectedClass
            ? `${selectedClass.displayName} · ${formatTime(editingCell?.period?.startTime)} – ${formatTime(editingCell?.period?.endTime)}`
            : ''
        }
        icon={CalendarDays}
        onClose={() => setEditingCell(null)}
        size="md"
        footer={
          <div className="modal-actions">
            {editingCell?.entry ? (
              <button
                type="button"
                className="admin-btn admin-btn-danger-ghost"
                onClick={removeCell}
                disabled={busy}
              >
                <Trash2 size={15} /> Remove slot
              </button>
            ) : null}
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditingCell(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={saveCell}
              disabled={busy}
            >
              {busy ? <span className="admin-spinner" /> : <Check size={16} />}
              {busy ? 'Saving…' : 'Save slot'}
            </button>
          </div>
        }
      >
        <div className="admin-form-grid timetable-slot-form">
          <label className="admin-field admin-span-2">
            <span>Subject</span>
            <select
              value={cellForm.subjectId}
              onChange={(event) => onSubjectChange(event.target.value)}
              required
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.subjectName} · {subject.subjectCode}
                  {subject.isLab ? ' · Lab' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Teacher</span>
            <select
              value={cellForm.teacherStaffId}
              onChange={(event) =>
                setCellForm((current) => ({ ...current, teacherStaffId: event.target.value }))
              }
              required
            >
              <option value="">Select teacher</option>
              {teachers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Room</span>
            <input
              type="text"
              value={cellForm.room}
              onChange={(event) =>
                setCellForm((current) => ({ ...current, room: event.target.value }))
              }
              placeholder={selectedClass?.room || 'Room / lab'}
            />
          </label>
          <p className="admin-form-note admin-span-2">
            The server checks teacher and class clashes before saving. A subject keeps its own
            assigned teacher unless you override it here.
          </p>
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        title="Week structure"
        subtitle="Choose working days, period times and how long the draft stays editable."
        icon={Settings2}
        onClose={() => setSettingsOpen(false)}
        size="lg"
        footer={
          <div className="modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setSettingsOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="timetable-settings-form"
              className="admin-btn admin-btn-primary"
              disabled={busy}
            >
              {busy ? <span className="admin-spinner" /> : <Check size={16} />}
              {busy ? 'Saving…' : 'Save week structure'}
            </button>
          </div>
        }
      >
        <form id="timetable-settings-form" className="timetable-settings-form" onSubmit={saveSettings}>
          <section>
            <div className="timetable-settings-head">
              <div>
                <h3>Working days</h3>
                <p>Classes can run Monday to Friday or Monday to Saturday. Sunday is never a teaching day.</p>
              </div>
              <Badge tone="brand">{settingsForm.days.length} days</Badge>
            </div>
            <div className="timetable-day-picker">
              {[1, 2, 3, 4, 5, 6].map((day) => {
                const label = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day - 1];
                const active = settingsForm.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={active ? 'active' : ''}
                    onClick={() =>
                      setSettingsForm((current) => ({
                        ...current,
                        days: active
                          ? current.days.filter((value) => value !== day)
                          : [...current.days, day].sort((a, b) => a - b),
                      }))
                    }
                  >
                    {active ? <Check size={14} /> : <span />} {label}
                  </button>
                );
              })}
            </div>
            <div className="timetable-settings-presets">
              <button
                type="button"
                onClick={() => setSettingsForm((current) => ({ ...current, days: [1, 2, 3, 4, 5] }))}
              >
                Monday–Friday
              </button>
              <button
                type="button"
                onClick={() => setSettingsForm((current) => ({ ...current, days: [1, 2, 3, 4, 5, 6] }))}
              >
                Monday–Saturday
              </button>
            </div>
            <div className="status-note admin-status-note timetable-settings-warning">
              <AlertTriangle size={15} />
              Disabling a working day or removing a period deletes the timetable slots on that day or
              period for every class.
            </div>
          </section>

          <section>
            <div className="timetable-settings-head">
              <div>
                <h3>Periods per day</h3>
                <p>Times are shared by every class. Existing slots move to the new times automatically.</p>
              </div>
              <Badge tone="brand">{settingsForm.periods.length} periods</Badge>
            </div>
            <div className="timetable-period-editor">
              {settingsForm.periods.map((period, index) => (
                <div key={period.periodNumber} className="timetable-period-row">
                  <span className="timetable-period-label">P{period.periodNumber}</span>
                  <label>
                    <span>Start</span>
                    <input
                      type="time"
                      value={period.startTime}
                      onChange={(event) => setPeriodTime(index, 'startTime', event.target.value)}
                      required
                    />
                  </label>
                  <span className="timetable-period-arrow">→</span>
                  <label>
                    <span>End</span>
                    <input
                      type="time"
                      value={period.endTime}
                      onChange={(event) => setPeriodTime(index, 'endTime', event.target.value)}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => removePeriod(index)}
                    disabled={settingsForm.periods.length === 1}
                    aria-label={`Remove period ${period.periodNumber}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-secondary admin-btn-sm"
              onClick={addPeriod}
              disabled={settingsForm.periods.length >= 10}
            >
              <Plus size={14} /> Add period
            </button>
          </section>

          <section>
            <div className="timetable-settings-head">
              <div>
                <h3>Editing window</h3>
                <p>The draft stays editable through this date. Publish manually when the week is final.</p>
              </div>
            </div>
            <label className="admin-field">
              <span>Editable until</span>
              <input
                type="date"
                value={settingsForm.editUntil}
                min={todayISO()}
                onChange={(event) =>
                  setSettingsForm((current) => ({ ...current, editUntil: event.target.value }))
                }
                required
              />
            </label>
            <div className="status-note admin-status-note">
              <CalendarClock size={15} />
              Default is the coming Sunday. After that date the builder locks until you extend it.
            </div>
          </section>

          {config.status === 'published' ? (
            <div className="settings-warning">
              <RefreshCw size={15} />
              Saving new days or period times will reopen the timetable as a draft. Publish it again
              when the changes are final.
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
