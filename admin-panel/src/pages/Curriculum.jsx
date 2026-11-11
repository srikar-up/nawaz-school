import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCopy,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import {
  curriculumPrompt,
  gradeLabel,
  gradesFromClasses,
  normalizeName,
  parseChapterLines,
  parseCurriculumJson,
  sectionsForGrade,
} from '../lib/curriculum';

function emptyEditor(grade) {
  return {
    mode: 'new',
    id: '',
    grade,
    name: '',
    code: '',
    lab: false,
    applyAll: true,
    chapterText: '',
    jsonText: '',
    message: '',
    busy: false,
  };
}

function chapterTitles(text) {
  return parseChapterLines(text);
}

export default function Curriculum() {
  const { data, user, notify, refresh } = useAppData();
  const classes = data.classes || [];
  const curricula = data.curricula || [];
  const subjects = data.subjects || [];
  const grades = useMemo(() => gradesFromClasses(classes), [classes]);
  const [grade, setGrade] = useState(grades[0] || 10);
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [applyingId, setApplyingId] = useState('');

  const sections = sectionsForGrade(classes, grade);
  const gradeCurricula = curricula.filter((entry) => entry.gradeLevel === grade);

  const offeringFor = (curriculum, section) => {
    const byLink = subjects.find(
      (subject) => subject.classIdSection === section && subject.curriculumId === curriculum.id
    );
    if (byLink) return byLink;
    const name = normalizeName(curriculum.subjectName);
    return subjects.find(
      (subject) =>
        subject.classIdSection === section && normalizeName(subject.subjectName) === name
    );
  };

  const coverage = (curriculum) =>
    sections.map((section) => ({ section, offering: offeringFor(curriculum, section) }));

  const openNew = () => setEditor(emptyEditor(grade));

  const openEdit = (curriculum) => {
    setEditor({
      mode: 'edit',
      id: curriculum.id,
      grade: curriculum.gradeLevel,
      name: curriculum.subjectName,
      code: curriculum.subjectCode,
      lab: Boolean(curriculum.isLab),
      applyAll: true,
      chapterText: (curriculum.chapters || []).map((chapter) => chapter.title).join('\n'),
      jsonText: '',
      message: '',
      busy: false,
    });
  };

  const fillFromJson = () => {
    const parsed = parseCurriculumJson(editor.jsonText);
    if (parsed.error) {
      setEditor((current) => ({ ...current, message: parsed.error }));
      return;
    }
    setEditor((current) => ({
      ...current,
      name: parsed.subjectName || current.name,
      code: parsed.subjectCode || current.code,
      lab: parsed.isLab ?? current.lab,
      chapterText: parsed.chapters.map((chapter) => chapter.title).join('\n'),
      message: parsed.usedPlainText
        ? `${parsed.chapters.length} chapters read from the pasted list.`
        : `${parsed.chapters.length} chapters read from the JSON.`,
    }));
  };

  const copyPrompt = async () => {
    const text = curriculumPrompt({ grade: editor.grade, subjectName: editor.name });
    try {
      await navigator.clipboard.writeText(text);
      setEditor((current) => ({
        ...current,
        message: 'Prompt copied. Attach your syllabus photo in the AI chat and paste this prompt.',
      }));
    } catch {
      setEditor((current) => ({
        ...current,
        message: 'Copying was blocked by the browser. Select the prompt text below and copy it.',
      }));
    }
  };

  const saveEditor = async () => {
    const name = editor.name.trim();
    const chapters = chapterTitles(editor.chapterText);
    if (name.length < 2) {
      setEditor((current) => ({ ...current, message: 'Enter the subject name.' }));
      return;
    }
    if (!chapters.length) {
      setEditor((current) => ({
        ...current,
        message: 'Add at least one chapter, or paste the AI JSON.',
      }));
      return;
    }

    setEditor((current) => ({ ...current, busy: true, message: '' }));
    try {
      if (editor.mode === 'new') {
        await api.createCurriculum(user.id, {
          gradeLevel: editor.grade,
          subjectName: name,
          subjectCode: editor.code.trim(),
          isLab: editor.lab,
          chapters: chapters.map((title) => ({ title })),
          sections: editor.applyAll ? sections : [],
        });
        notify(
          editor.applyAll
            ? `${name} added to Grade ${editor.grade} and ${sections.length} sections.`
            : `${name} added to the Grade ${editor.grade} curriculum.`,
          'success'
        );
      } else {
        await api.updateCurriculum(user.id, editor.id, {
          subjectName: name,
          subjectCode: editor.code.trim(),
          isLab: editor.lab,
          chapters: chapters.map((title) => ({ title })),
        });
        notify(`${name} curriculum updated in every section.`, 'success');
      }
      await refresh({ silent: true });
      setEditor(null);
    } catch (error) {
      setEditor((current) => ({ ...current, busy: false, message: error.message }));
    }
  };

  const applyToAll = async (curriculum) => {
    setApplyingId(curriculum.id);
    try {
      const result = await api.applyCurriculum(user.id, curriculum.id, sections);
      await refresh({ silent: true });
      notify(
        result.created
          ? `${curriculum.subjectName} added to ${result.created} section${result.created === 1 ? '' : 's'}.`
          : `${curriculum.subjectName} was already in every section.`,
        'success'
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setApplyingId('');
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.deleteCurriculum(user.id, target.id);
      await refresh({ silent: true });
      notify(
        `${target.subjectName} removed from the Grade ${target.gradeLevel} curriculum. Class subjects were kept.`,
        'success'
      );
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const parsedCount = editor ? chapterTitles(editor.chapterText).length : 0;

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Academic structure"
        title="Curriculum & syllabus"
        subtitle="Set a subject up once for a class standard, then share it with every section of that grade."
        actions={
          <button type="button" className="admin-btn admin-btn-primary" onClick={openNew}>
            <Plus size={16} /> Add subject
          </button>
        }
      />

      <div className="class-selector-strip">
        {grades.map((value) => {
          const count = sectionsForGrade(classes, value).length;
          return (
            <button
              key={value}
              type="button"
              className={`class-selector-card ${value === grade ? 'active' : ''}`}
              onClick={() => setGrade(value)}
            >
              <span className="class-id-badge">{value}</span>
              <span>
                <strong>{gradeLabel(value)}</strong>
                <small>
                  {count} section{count === 1 ? '' : 's'} ·{' '}
                  {curricula.filter((entry) => entry.gradeLevel === value).length} subjects
                </small>
              </span>
              {value === grade ? <Check size={16} /> : <ChevronRight size={16} />}
            </button>
          );
        })}
      </div>

      <section className="admin-card curriculum-coverage-card">
        <div className="admin-card-head">
          <div>
            <h2>{gradeLabel(grade)} subject coverage</h2>
            <p>One check means the subject is already set up in that section.</p>
          </div>
          <Badge tone="brand">
            {gradeCurricula.length} subject{gradeCurricula.length === 1 ? '' : 's'}
          </Badge>
        </div>

        {gradeCurricula.length ? (
          <div className="curriculum-table-wrap">
            <table className="curriculum-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Chapters</th>
                  {sections.map((section) => (
                    <th key={section}>{section}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {gradeCurricula.map((curriculum) => {
                  const cells = coverage(curriculum);
                  const missing = cells.filter((cell) => !cell.offering).length;
                  return (
                    <tr key={curriculum.id}>
                      <td>
                        <span className="curriculum-name">
                          <BookOpen size={16} />
                          <span>
                            <strong>{curriculum.subjectName}</strong>
                            <small>
                              {curriculum.subjectCode}
                              {curriculum.isLab ? ' · Lab' : ''}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Badge tone="neutral">{(curriculum.chapters || []).length}</Badge>
                      </td>
                      {cells.map(({ section, offering }) => (
                        <td key={section}>
                          {offering ? (
                            <span className="curriculum-cell set">
                              <Check size={14} />
                              <span>
                                {offering.assignedTeacherName &&
                                offering.assignedTeacherName !== 'Unassigned'
                                  ? offering.assignedTeacherName
                                  : 'No teacher yet'}
                              </span>
                            </span>
                          ) : (
                            <span className="curriculum-cell missing">
                              <TriangleAlert size={14} /> Not set
                            </span>
                          )}
                        </td>
                      ))}
                      <td>
                        <div className="curriculum-row-actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => openEdit(curriculum)}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => applyToAll(curriculum)}
                            disabled={applyingId === curriculum.id || missing === 0}
                          >
                            <Layers size={14} />
                            {applyingId === curriculum.id
                              ? 'Adding…'
                              : missing
                                ? `Add to ${missing} section${missing === 1 ? '' : 's'}`
                                : 'Shared'}
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            onClick={() => setDeleteTarget(curriculum)}
                            aria-label={`Remove ${curriculum.subjectName}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="curriculum-empty">
            <span className="help-icon">
              <BookOpen size={20} />
            </span>
            <div>
              <strong>No subjects for {gradeLabel(grade)} yet</strong>
              <p>
                Add Mathematics, Science or any other subject once and share it with every section
                of this standard.
              </p>
            </div>
            <button type="button" className="admin-btn admin-btn-primary" onClick={openNew}>
              <Plus size={16} /> Add the first subject
            </button>
          </div>
        )}
      </section>

      <section className="admin-card curriculum-sections-card">
        <div className="admin-card-head">
          <div>
            <h2>Sections in {gradeLabel(grade)}</h2>
            <p>Teacher assignment and timetable stay in Classes &amp; subjects.</p>
          </div>
          <Link to="/classes" className="admin-btn admin-btn-secondary admin-btn-sm">
            <Users size={14} /> Open classes
          </Link>
        </div>
        <div className="curriculum-section-list">
          {sections.map((section) => (
            <Link key={section} to={`/classes?class=${section}`} className="curriculum-section">
              <span className="class-id-badge">{section}</span>
              <span>
                <strong>
                  {classes.find((cls) => cls.id === section)?.displayName || section}
                </strong>
                <small>
                  {subjects.filter((subject) => subject.classIdSection === section).length} subjects
                </small>
              </span>
              <Pencil size={14} />
            </Link>
          ))}
        </div>
      </section>

      {editor ? (
        <Modal
          open
          onClose={() => (editor.busy ? null : setEditor(null))}
          title={editor.mode === 'new' ? 'Add curriculum subject' : 'Edit curriculum subject'}
          subtitle={`${gradeLabel(editor.grade)} · shared by every section of this standard`}
          icon={BookOpen}
          size="lg"
          footer={
            <div className="curriculum-editor-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setEditor(null)}
                disabled={editor.busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={saveEditor}
                disabled={editor.busy}
              >
                {editor.busy ? <span className="admin-spinner" /> : null}
                {editor.busy
                  ? 'Saving…'
                  : editor.mode === 'new'
                    ? editor.applyAll
                      ? 'Create and share'
                      : 'Create subject'
                    : 'Save changes'}
              </button>
            </div>
          }
        >
          <div className="curriculum-editor">
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Subject name</span>
                <input
                  type="text"
                  value={editor.name}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Mathematics"
                  disabled={editor.busy}
                />
              </label>
              <label className="admin-field">
                <span>Subject code</span>
                <input
                  type="text"
                  value={editor.code}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="MATH-10"
                  disabled={editor.busy}
                />
              </label>
              <label className="curriculum-check admin-span-2">
                <input
                  type="checkbox"
                  checked={editor.lab}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, lab: event.target.checked }))
                  }
                  disabled={editor.busy}
                />
                <span>This subject needs a science or computer lab</span>
              </label>
            </div>

            <div className="curriculum-chapters-head">
              <div>
                <strong>Chapters</strong>
                <p>One chapter per line. Existing progress is kept by chapter name.</p>
              </div>
              <Badge tone="neutral">{parsedCount} chapters</Badge>
            </div>
            <textarea
              className="curriculum-chapter-textarea"
              rows={8}
              value={editor.chapterText}
              onChange={(event) =>
                setEditor((current) => ({ ...current, chapterText: event.target.value }))
              }
              placeholder={'Quadratic Equations\nArithmetic Progression\nCoordinate Geometry'}
              disabled={editor.busy}
              aria-label="Chapter list"
            />

            <section className="curriculum-ai-panel">
              <div className="curriculum-ai-head">
                <span className="help-icon">
                  <Sparkles size={18} />
                </span>
                <div>
                  <strong>Use a syllabus photo</strong>
                  <p>
                    Copy the prompt into any AI chat with the syllabus image, then paste the JSON
                    reply below.
                  </p>
                </div>
                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={copyPrompt}>
                  <ClipboardCopy size={14} /> Copy prompt
                </button>
              </div>
              <textarea
                rows={5}
                value={editor.jsonText}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, jsonText: event.target.value }))
                }
                placeholder={
                  '{\n  "subjectName": "Mathematics",\n  "chapters": [{ "title": "Quadratic Equations" }]\n}'
                }
                disabled={editor.busy}
                aria-label="Pasted JSON from the AI"
              />
              <div className="curriculum-ai-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={fillFromJson}
                  disabled={editor.busy || !editor.jsonText.trim()}
                >
                  <BookOpen size={14} /> Fill chapters from this
                </button>
                <span className="muted small">
                  You can also paste a plain numbered list — the numbering is removed.
                </span>
              </div>
            </section>

            {editor.mode === 'new' ? (
              <label className="curriculum-check">
                <input
                  type="checkbox"
                  checked={editor.applyAll}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, applyAll: event.target.checked }))
                  }
                  disabled={editor.busy}
                />
                <span>
                  Add to all {sections.length} {gradeLabel(editor.grade)} sections now
                </span>
              </label>
            ) : null}

            {editor.message ? (
              <p className="curriculum-editor-message" role="status">
                {editor.message}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title="Remove this subject?"
          subtitle={`${gradeLabel(deleteTarget.gradeLevel)} · ${deleteTarget.subjectName}`}
          icon={TriangleAlert}
          size="sm"
          footer={
            <div className="curriculum-editor-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Keep subject
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={remove}>
                <Trash2 size={15} /> Remove
              </button>
            </div>
          }
        >
          <p className="muted">
            It will disappear from the class-standard curriculum. Subject cards already added to a
            section stay, along with their chapters and teacher.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
