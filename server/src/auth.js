import { adminAuth } from './firebase.js';
import { getDb } from './store.js';

const CHECK_REVOKED = String(process.env.AUTH_CHECK_REVOKED || '').toLowerCase() === 'true';

/**
 * Extracts an ID token from the Authorization header.
 *
 * Tokens are intentionally never accepted from the query string: URLs end up
 * in proxy logs, browser history and referrers.
 */
export function extractBearer(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
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
/**
 * Resolves the staff record a verified token belongs to.
 *
 * Password accounts were created with uid === staff id. Google sign-in creates
 * a Firebase user whose uid is Google's, so the verified email is the fallback.
 * An unverified email is never trusted for that mapping.
 */
export function resolveStaff(db, decoded) {
  const direct = db.staff.find((member) => member.id === decoded?.uid);
  if (direct) return direct;

  const email = String(decoded?.email || '').trim().toLowerCase();
  if (!decoded?.email_verified || !email) return null;

  return (
    db.staff.find((member) => String(member.email || '').trim().toLowerCase() === email) || null
  );
}

export async function requireActor(req, res, next) {
  const token = extractBearer(req);

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

  // Password accounts have uid === staff id. Google sign-in creates a Firebase
  // user whose uid is Google's, so fall back to the verified email address.
  // Unverified emails are never trusted for this mapping.
  const actor = resolveStaff(db, decoded);

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
