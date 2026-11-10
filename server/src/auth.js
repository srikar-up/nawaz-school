import { adminAuth } from './firebase.js';
import { getDb } from './store.js';

const CHECK_REVOKED = String(process.env.AUTH_CHECK_REVOKED || '').toLowerCase() === 'true';

/**
 * Extracts an ID token from the request.
 *
 * The header is the norm. The `?token=` query fallback exists only because
 * EventSource cannot set headers for the SSE stream; it is limited to that
 * endpoint by the caller.
 */
export function extractBearer(req, { allowQueryToken = false } = {}) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) return match[1].trim();

  if (allowQueryToken) {
    const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    if (queryToken) return queryToken;
  }
  return null;
}

export async function verifyIdToken(token) {
  return adminAuth().verifyIdToken(token, CHECK_REVOKED);
}

/**
 * Authenticates the request with a Firebase ID token and resolves the matching
 * staff record.
 *
 * Firebase UIDs are created equal to the staff id (STF-001, ...) by
 * scripts/create-auth-users.mjs, so the token identifies the person directly.
 * Nothing about identity is read from the request body or headers.
 */
export async function requireActor(req, res, next) {
  const allowQueryToken = req.path === '/api/events' || req.originalUrl.startsWith('/api/events');
  const token = extractBearer(req, { allowQueryToken });

  if (!token) {
    return res.status(401).json({ error: 'Sign-in required.' });
  }

  let decoded;
  try {
    decoded = await verifyIdToken(token);
  } catch (error) {
    const expired = error?.code === 'auth/id-token-expired';
    return res
      .status(401)
      .json({ error: expired ? 'Your session expired. Sign in again.' : 'Invalid sign-in token.' });
  }

  const db = getDb();
  const actor = db.staff.find((member) => member.id === decoded.uid);

  if (!actor) {
    return res
      .status(403)
      .json({ error: 'No staff profile is linked to this account. Ask an administrator.' });
  }
  if (!actor.isActive) {
    return res.status(403).json({ error: 'This account has been deactivated.' });
  }

  req.actor = actor;
  req.auth = decoded;
  return next();
}
