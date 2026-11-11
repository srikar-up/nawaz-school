import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileSpreadsheet,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import {
  buildExportBundle,
  buildImportPreview,
  collectionLabel,
  DATA_COLLECTIONS,
  downloadBlob,
  downloadCollectionCsv,
  downloadImportErrors,
  downloadSchema,
  getCollectionStats,
  parseImportFiles,
} from '../lib/dataExchange';
import { relativeTime, todayISO } from '../lib/format';

function modeLabel(mode) {
  return mode === 'replace' ? 'Replace imported tables' : 'Merge / upsert';
}

export default function DataExchange() {
  const { data, user, permissions, notify, refresh } = useAppData();
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('merge');
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const [parseStatus, setParseStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [expandedCollection, setExpandedCollection] = useState('');

  const schema = useMemo(() => getCollectionStats(data), [data]);
  const totalRecords = useMemo(
    () =>
      DATA_COLLECTIONS.reduce((sum, def) => {
        if (def.key === 'meta') return sum + 1;
        return sum + (Array.isArray(data[def.key]) ? data[def.key].length : 0);
      }, 0),
    [data]
  );
  const preview = useMemo(
    () =>
      parsed
        ? buildImportPreview(parsed, data, mode, { actorId: user.id })
        : null,
    [parsed, data, mode, user.id]
  );
  const warningMessages = useMemo(() => {
    if (!preview) return [];
    return [
      ...(preview.parseWarnings || []).map((message) => ({
        collection: 'files',
        row: '',
        field: '',
        message,
      })),
      ...(preview.warnings || []),
    ];
  }, [preview]);
  const canImport =
    permissions.superAdmin && preview && !preview.errors.length && !importing;

  const resetSelection = () => {
    setParsed(null);
    setParseError('');
    setParseStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readFiles = async (fileList) => {
    if (!fileList?.length) return;
    setParseError('');
    setParseStatus('Reading files locally…');
    try {
      const result = await parseImportFiles(fileList, {
        onProgress: ({ index, total, name }) =>
          setParseStatus(`Reading ${index + 1} of ${total}: ${name}`),
      });
      setParsed(result);
      setParseStatus('');
      setLastImport(null);
    } catch (error) {
      setParsed(null);
      setParseStatus('');
      setParseError(error.message);
    }
  };

  const exportBundle = async () => {
    setExporting(true);
    try {
      const { blob, fileName, manifest } = await buildExportBundle(data);
      downloadBlob(blob, fileName);
      notify(
        `CSV bundle exported: ${Object.values(manifest.counts).reduce((sum, count) => sum + count, 0)} rows across ${DATA_COLLECTIONS.length} datasets.`,
        'success'
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const importBundle = async () => {
    if (!preview || !parsed) return;
    setImporting(true);
    try {
      const importedCollections = Object.fromEntries(
        Object.keys(preview.summary).map((key) => [key, preview.data[key]])
      );
      const result = await api.importData(user.id, {
        mode,
        collections: importedCollections,
      });
      const fresh = await refresh({ silent: true });
      setLastImport(result);
      const saved =
        fresh?.meta?.revision !== undefined &&
        Number(fresh.meta.revision) >= Number(result.revision);
      if (!saved) {
        notify(
          'The import was accepted, but the saved copy could not be confirmed. Check the connection and reload before doing more work.',
          'warning'
        );
      } else {
        notify(
          `Saved to the school database: ${Object.keys(result.summary || {}).length} dataset${Object.keys(result.summary || {}).length === 1 ? '' : 's'} committed.`,
          'success'
        );
      }
      resetSelection();
    } catch (error) {
      if (error.errors?.length) {
        notify(`${error.message} ${error.errors.length} validation issue(s).`, 'error');
      } else {
        notify(error.message, 'error');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="admin-page data-exchange-page">
      <PageHeader
        eyebrow="Data & portability"
        title="Data exchange"
        subtitle="Two-way CSV import and export. Files are parsed and validated locally before anything is written."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={exportBundle}
            disabled={exporting}
          >
            {exporting ? <span className="admin-spinner" /> : <Archive size={16} />}
            {exporting ? 'Building bundle…' : 'Download full CSV bundle'}
          </button>
        }
      />

      <div className="mini-stat-row">
        <div className="mini-stat">
          <span>Datasets</span>
          <strong>{DATA_COLLECTIONS.length}</strong>
          <small>one CSV file each</small>
        </div>
        <div className="mini-stat success">
          <span>Records in cache</span>
          <strong>{totalRecords}</strong>
          <small>including nested rows</small>
        </div>
        <div className="mini-stat info">
          <span>Validation</span>
          <strong>{preview ? (preview.errors.length ? 'Issues' : 'Ready') : 'Local'}</strong>
          <small>{preview ? 'in browser' : 'waiting for a file'}</small>
        </div>
        <div className="mini-stat warning">
          <span>Last data revision</span>
          <strong>{data.meta.revision}</strong>
          <small>{relativeTime(data.meta.updatedAt)}</small>
        </div>
      </div>

      <section className="admin-card data-flow-card">
        <div className="data-flow">
          <div className="data-flow-step">
            <span className="data-flow-number">1</span>
            <div>
              <strong>Export locally</strong>
              <small>Download one ZIP with every dataset as a CSV.</small>
            </div>
          </div>
          <ArrowRight size={18} />
          <div className="data-flow-step">
            <span className="data-flow-number">2</span>
            <div>
              <strong>Edit safely</strong>
              <small>Use Excel, Sheets or any CSV editor.</small>
            </div>
          </div>
          <ArrowRight size={18} />
          <div className="data-flow-step">
            <span className="data-flow-number">3</span>
            <div>
              <strong>Validate in memory</strong>
              <small>Rows, links, dates and calculations are checked before commit.</small>
            </div>
          </div>
          <ArrowRight size={18} />
          <div className="data-flow-step">
            <span className="data-flow-number">4</span>
            <div>
              <strong>Commit &amp; sync</strong>
              <small>The approved dataset updates both PWAs; Firebase adapter later.</small>
            </div>
          </div>
        </div>
      </section>

      <div className="data-exchange-layout">
        <section className="admin-card data-export-card">
          <div className="admin-card-head">
            <div>
              <h2>Export</h2>
              <p>Every table in the shared school schema.</p>
            </div>
            <span className="data-icon-badge indigo">
              <Download size={19} />
            </span>
          </div>

          <div className="data-export-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary admin-btn-block"
              onClick={exportBundle}
              disabled={exporting}
            >
              {exporting ? <span className="admin-spinner" /> : <Archive size={16} />}
              {exporting ? 'Building ZIP…' : 'Download CSV bundle (.zip)'}
            </button>
            <div className="data-export-secondary">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => downloadSchema(data)}
              >
                <FileSpreadsheet size={15} /> Schema JSON
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() =>
                  downloadBlob(
                    new Blob(
                      [
                        JSON.stringify(
                          Object.fromEntries(
                            DATA_COLLECTIONS.map((def) => [def.key, data[def.key]])
                          ),
                          null,
                          2
                        ),
                      ],
                      { type: 'application/json' }
                    ),
                    `nawaz-school-data-${todayISO()}.json`
                  )
                }
              >
                <Database size={15} /> JSON backup
              </button>
            </div>
          </div>

          <div className="data-collection-list">
            {schema.map((def) => (
              <div
                key={def.key}
                className={`data-collection-row ${expandedCollection === def.key ? 'expanded' : ''}`}
              >
                <button
                  type="button"
                  className="data-collection-main"
                  onClick={() =>
                    setExpandedCollection((current) => (current === def.key ? '' : def.key))
                  }
                  aria-expanded={expandedCollection === def.key}
                >
                  <span className="data-file-icon">
                    <FileSpreadsheet size={16} />
                  </span>
                  <span>
                    <strong>{def.label}</strong>
                    <small>
                      {def.file} · {def.rows} row{def.rows === 1 ? '' : 's'} · {def.columns} columns
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => downloadCollectionCsv(data, def.key)}
                  aria-label={`Download ${def.file}`}
                  title={`Download ${def.file}`}
                >
                  <Download size={15} />
                </button>
                {expandedCollection === def.key ? (
                  <div className="data-collection-detail">
                    <p>{def.description}</p>
                    <div className="data-detail-grid">
                      <span>
                        <small>Primary key</small>
                        <strong>{def.primaryKey || 'object'}</strong>
                      </span>
                      <span>
                        <small>Required fields</small>
                        <strong>{def.required.length || '—'}</strong>
                      </span>
                      <span>
                        <small>Relationships</small>
                        <strong>{def.foreignKeys.length || '—'}</strong>
                      </span>
                    </div>
                    <div className="data-field-chips">
                      {def.fields.slice(0, 18).map((field) => (
                        <code key={field}>{field}</code>
                      ))}
                      {def.fields.length > 18 ? <code>+{def.fields.length - 18} more</code> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card data-import-card">
          <div className="admin-card-head">
            <div>
              <h2>Import</h2>
              <p>Parse first, validate second, write only after you confirm.</p>
            </div>
            <span className="data-icon-badge teal">
              <Upload size={19} />
            </span>
          </div>

          {!permissions.superAdmin ? (
            <div className="settings-warning">
              <ShieldCheck size={16} />
              Only a SuperAdmin can commit an import. You can still export data.
            </div>
          ) : null}

          <label
            className={`data-dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              readFiles(event.dataTransfer.files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip,.csv,.json"
              onChange={(event) => readFiles(event.target.files)}
              disabled={!permissions.superAdmin || importing}
            />
            <span className="data-dropzone-icon">
              <Upload size={24} />
            </span>
            <strong>Drop the exported ZIP here</strong>
            <span>or choose individual CSV files</span>
            <small>Expected names: {DATA_COLLECTIONS.slice(0, 5).map((def) => def.file).join(', ')} …</small>
          </label>

          {parseStatus ? (
            <div className="data-parse-status">
              <RefreshCw size={15} className="spin" /> {parseStatus}
            </div>
          ) : null}

          {parseError ? (
            <div className="data-message danger">
              <XCircle size={17} />
              <span>{parseError}</span>
            </div>
          ) : null}

          <div className="data-import-options">
            <span>When a row already exists:</span>
            <label>
              <input
                type="radio"
                name="import-mode"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
              />
              <span>
                <strong>Merge / upsert</strong>
                <small>Update matching IDs, add new rows, keep everything else.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="import-mode"
                value="replace"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              <span>
                <strong>Replace imported tables</strong>
                <small>Replace only the CSVs you supplied; other tables stay intact.</small>
              </span>
            </label>
          </div>

          {preview ? (
            <div className="data-preview">
              <div className={`data-preview-banner ${preview.errors.length ? 'danger' : 'success'}`}>
                {preview.errors.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                <div>
                  <strong>
                    {preview.errors.length
                      ? `${preview.errors.length} issue${preview.errors.length === 1 ? '' : 's'} found`
                      : 'Local validation passed'}
                  </strong>
                  <span>
                    {preview.fileNames.length} file
                    {preview.fileNames.length === 1 ? '' : 's'} · {modeLabel(mode)}
                  </span>
                </div>
                <Badge tone={preview.errors.length ? 'danger' : 'success'}>
                  {preview.errors.length ? 'Fix before import' : 'Ready to sync'}
                </Badge>
              </div>

              <div className="data-preview-files">
                {preview.sources.map((source) => (
                  <span key={`${source.file}-${source.collection}`}>
                    <FileSpreadsheet size={13} /> {source.file}{' '}
                    <small>→ {collectionLabel(source.collection)}</small>
                  </span>
                ))}
              </div>

              <div className="data-preview-grid">
                {Object.entries(preview.summary).map(([key, entry]) => (
                  <div key={key} className="data-preview-row">
                    <span>
                      <strong>{entry.label || collectionLabel(key)}</strong>
                      <small>
                        {entry.importedRows} imported · {entry.after} after ·{' '}
                        {entry.mode === 'replace' ? `${entry.removed} removed` : `${entry.added} new`}
                      </small>
                    </span>
                    <div className="data-preview-counts">
                      <span className="data-count-added">+{entry.added}</span>
                      <span className="data-count-updated">↻{entry.updated}</span>
                      {entry.removed ? (
                        <span className="data-count-removed">−{entry.removed}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="data-calc-card">
                <div className="data-calc-head">
                  <Sparkles size={16} />
                  <span>Calculated from the validated dataset</span>
                </div>
                <div className="data-calc-grid">
                  <div>
                    <span>Attendance rate</span>
                    <strong>{preview.calculations.attendanceRate}%</strong>
                    <small>{preview.calculations.attendanceTotal} entries</small>
                  </div>
                  <div>
                    <span>Score average</span>
                    <strong>{preview.calculations.scoreAverage}%</strong>
                    <small>{preview.calculations.scores} scores</small>
                  </div>
                  <div>
                    <span>Open exams</span>
                    <strong>{preview.calculations.openExams}</strong>
                    <small>waiting for marks</small>
                  </div>
                  <div>
                    <span>Students</span>
                    <strong>{preview.calculations.students}</strong>
                    <small>{preview.calculations.classes} classes</small>
                  </div>
                </div>
              </div>

              {warningMessages.length ? (
                <details className="data-issues data-warnings">
                  <summary>
                    <FileWarning size={15} /> {warningMessages.length} warning
                    {warningMessages.length === 1 ? '' : 's'} — import is still allowed
                  </summary>
                  <ul>
                    {warningMessages.slice(0, 40).map((warning, index) => (
                      <li key={`${warning.collection}-${warning.row}-${index}`}>
                        <strong>{collectionLabel(warning.collection)}</strong>
                        {warning.row ? ` · row ${warning.row}` : ''} — {warning.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {preview.errors.length ? (
                <details className="data-issues data-errors" open>
                  <summary>
                    <AlertTriangle size={15} /> {preview.errors.length} error
                    {preview.errors.length === 1 ? '' : 's'} — import is blocked
                  </summary>
                  <ul>
                    {preview.errors.slice(0, 40).map((error, index) => (
                      <li key={`${error.collection}-${error.row}-${error.field}-${index}`}>
                        <strong>{collectionLabel(error.collection)}</strong>
                        {error.row ? ` · row ${error.row}` : ''}
                        {error.field ? ` · ${error.field}` : ''} — {error.message}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary admin-btn-sm"
                    onClick={() => downloadImportErrors(preview.errors)}
                  >
                    <Download size={14} /> Download error report
                  </button>
                </details>
              ) : null}

              <div className="data-unsaved-warning">
                <AlertTriangle size={15} />
                <span>
                  <strong>Preview only.</strong> Nothing has reached the school database yet. Press
                  the button below to save.
                </span>
              </div>

              <button
                type="button"
                className="admin-btn admin-btn-primary admin-btn-block admin-btn-lg"
                onClick={importBundle}
                disabled={!canImport}
              >
                {importing ? <span className="admin-spinner" /> : <Cloud size={17} />}
                {importing
                  ? 'Committing and syncing…'
                  : `Commit ${mode === 'replace' ? 'replacement' : 'merge'} & sync`}
              </button>
              <p className="data-commit-note">
                <ShieldCheck size={13} /> Nothing is written until this button is pressed. The server
                re-validates the same schema before replacing the shared cache.
              </p>
            </div>
          ) : (
            <div className="data-empty">
              <Database size={22} />
              <strong>No import staged</strong>
              <span>Export a bundle, edit the CSVs, then drop the ZIP here for a dry run.</span>
            </div>
          )}

          {data.meta?.lastImport ? (
            <div className="data-last-import" data-saved-import>
              <CheckCircle2 size={17} />
              <div>
                <strong>Saved to the school database</strong>
                <span>
                  {(data.meta.lastImport.datasets || []).length} dataset
                  {(data.meta.lastImport.datasets || []).length === 1 ? '' : 's'} ·{' '}
                  {relativeTime(data.meta.lastImport.at)}
                  {data.meta.lastImport.byName ? ` · by ${data.meta.lastImport.byName}` : ''} ·
                  revision {data.meta.revision}
                </span>
              </div>
            </div>
          ) : lastImport ? (
            <div className="data-last-import">
              <CheckCircle2 size={17} />
              <div>
                <strong>Last import synced</strong>
                <span>
                  {Object.keys(lastImport.summary || {}).length} datasets · revision{' '}
                  {lastImport.revision} · {modeLabel(lastImport.mode)}
                </span>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="admin-card data-schema-card">
        <div className="admin-card-head">
          <div>
            <h2>Canonical data schema</h2>
            <p>
              The same schema drives the CSV files, local validation, the shared cache and the future
              Firebase collections.
            </p>
          </div>
          <Badge tone="brand">{DATA_COLLECTIONS.length} datasets</Badge>
        </div>
        <div className="table-scroll">
          <table className="admin-table data-schema-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>CSV file</th>
                <th>Rows</th>
                <th>Primary key</th>
                <th>Relationships</th>
                <th>Rules</th>
              </tr>
            </thead>
            <tbody>
              {schema.map((def) => (
                <tr key={def.key}>
                  <td>
                    <span className="table-stack">
                      <strong>{def.label}</strong>
                      <small>{def.description}</small>
                    </span>
                  </td>
                  <td>
                    <code className="data-file-code">{def.file}</code>
                  </td>
                  <td>{def.rows}</td>
                  <td>{def.primaryKey || 'object'}</td>
                  <td>
                    {def.foreignKeys.length
                      ? def.foreignKeys.map((fk) => `${fk.field} → ${fk.collection}`).join(', ')
                      : '—'}
                  </td>
                  <td>
                    <span className="data-rule-chips">
                      {def.required.length ? <span>{def.required.length} required</span> : null}
                      {def.enums ? <span>{Object.keys(def.enums).length} enums</span> : null}
                      {def.uniquePairs ? <span>{def.uniquePairs.length} unique</span> : null}
                      {def.nestedEntries ? <span>nested rows</span> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>
            JSON inside a CSV cell is fully supported for nested fields such as attendance entries,
            syllabus chapters and assessment records.
          </span>
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => downloadSchema(data)}>
            <Download size={14} /> schema.json
          </button>
        </div>
      </section>
    </div>
  );
}
