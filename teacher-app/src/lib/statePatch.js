/**
 * Applies a delta event from `/api/events` (or `/api/changes`) to the cached
 * school state.
 *
 * The server sends whole small collections (`collections`) and only the
 * changed rows for high-growth collections (`upserts`/`deletes`). A `full`
 * flag means the client must refetch once - imports, resets and bulk roster
 * operations take that path.
 */
export function applyServerChange(current, change) {
  if (!current) return null;
  if (!change || change.full) return null;

  const next = { ...current };
  if (change.meta) next.meta = change.meta;

  const wholeCollections = change.collections || {};
  Object.entries(wholeCollections).forEach(([key, items]) => {
    next[key] = Array.isArray(items) ? items : [];
  });

  const upserts = change.upserts || {};
  const deletes = change.deletes || {};
  const keys = new Set([...Object.keys(upserts), ...Object.keys(deletes)]);

  keys.forEach((key) => {
    if (wholeCollections[key] !== undefined) return;
    if (!Array.isArray(next[key])) next[key] = [];

    const rows = [...next[key]];
    const indexById = new Map(rows.map((row, index) => [row.id, index]));

    (deletes[key] || []).forEach((id) => {
      const index = indexById.get(id);
      if (index !== undefined) rows[index] = null;
    });

    (upserts[key] || []).forEach((row) => {
      const index = indexById.get(row.id);
      if (index !== undefined && rows[index]) {
        rows[index] = row;
      } else {
        indexById.set(row.id, rows.length);
        rows.push(row);
      }
    });

    next[key] = rows.filter(Boolean);
  });

  return next;
}

/** True when an event actually carries a patch worth applying. */
export function hasPatch(change) {
  return Boolean(
    change &&
      !change.full &&
      (change.meta ||
        Object.keys(change.collections || {}).length ||
        Object.keys(change.upserts || {}).length ||
        Object.keys(change.deletes || {}).length)
  );
}
