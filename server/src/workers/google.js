/**
 * Firebase access for the Workers runtime.
 *
 * firebase-admin cannot run on Workers: its Firestore client speaks gRPC, which
 * needs raw TCP, and google-gax assumes CommonJS globals at load time. This
 * module implements the small slice the API actually uses, over Google's REST
 * endpoints, behind the same shape as the Admin SDK:
 *
 *   adminDb().collection('school').doc('staff').get() / .set() / batch()
 *   adminAuth().verifyIdToken(token)
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON (a Worker secret). Access tokens
 * are minted with WebCrypto RS256 and cached until shortly before expiry.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/datastore';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';

let serviceAccountCache;
let accessToken = null;
let accessTokenExpiresAt = 0;

function serviceAccount() {
  if (serviceAccountCache !== undefined) return serviceAccountCache;

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!inline) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set on this Worker.');
  }

  try {
    serviceAccountCache = JSON.parse(inline);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
  }
  return serviceAccountCache;
}

export function projectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccount().project_id ||
    'thiangle-349e7'
  );
}

function base64Url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function mintAccessToken() {
  const account = serviceAccount();
  if (!account.client_email || !account.private_key) {
    throw new Error('The service account is missing client_email or private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify(claims)
  )}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );

  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Could not mint a Google access token (${response.status}): ${
        body.error_description || body.error || 'unknown error'
      }`
    );
  }

  accessToken = body.access_token;
  accessTokenExpiresAt = Date.now() + (Number(body.expires_in) || 3600) * 1000 - 120_000;
  return accessToken;
}

export async function googleAccessToken() {
  if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;
  return mintAccessToken();
}

/* ------------------------------------------------------------------ */
/* Firestore value encoding                                            */
/* ------------------------------------------------------------------ */

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      fields[key] = encodeValue(entry);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) result[key] = decodeValue(value);
  return result;
}

function documentName(path) {
  return `projects/${projectId()}/databases/(default)/documents/${path}`;
}

async function firestoreFetch(path, options = {}) {
  const token = await googleAccessToken();
  const response = await fetch(`${FIRESTORE_BASE}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response;
}

/* ------------------------------------------------------------------ */
/* Admin-SDK-compatible surface                                        */
/* ------------------------------------------------------------------ */

function documentRef(path) {
  return {
    name: documentName(path),
    async get() {
      const response = await firestoreFetch(documentName(path));
      if (response.status === 404) {
        return { exists: false, data: () => undefined };
      }
      const body = await response.json();
      if (!response.ok) {
        throw new Error(`Firestore read failed (${response.status}): ${body?.error?.message || ''}`);
      }
      const data = decodeFields(body.fields || {});
      return { exists: true, data: () => data };
    },
    toWrite(data) {
      return { update: { name: documentName(path), fields: encodeValue(data).mapValue.fields } };
    },
  };
}

export function createRestFirestore() {
  return {
    settings() {},
    collection(root) {
      return {
        doc(id) {
          return documentRef(`${root}/${id}`);
        },
      };
    },
    batch() {
      const writes = [];
      return {
        set(ref, data) {
          writes.push(ref.toWrite(data));
        },
        delete(ref) {
          writes.push({ delete: ref.name });
        },
        async commit() {
          if (!writes.length) return [];
          const response = await firestoreFetch(
            `projects/${projectId()}/databases/(default)/documents:commit`,
            { method: 'POST', body: JSON.stringify({ writes }) }
          );
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(
              `Firestore write failed (${response.status}): ${body?.error?.message || ''}`
            );
          }
          return body.writeResults || [];
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* ID token verification                                               */
/* ------------------------------------------------------------------ */

const userCache = new Map();

function tokenError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Verifies an ID token by asking Identity Toolkit to resolve it.
 *
 * The token is validated by Google rather than locally, so no X.509 parsing or
 * JWKS caching is needed in the Worker. Results are cached briefly by token to
 * keep the extra round trip off hot paths.
 */
export async function lookupIdToken(idToken) {
  const cached = userCache.get(idToken);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_API_KEY is not set on this Worker.');

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  const body = await response.json().catch(() => ({}));
  const message = body?.error?.message || '';

  if (!response.ok || !body.users?.length) {
    if (message.startsWith('TOKEN_EXPIRED')) {
      throw tokenError('ID token has expired.', 'auth/id-token-expired');
    }
    if (message.includes('API key not valid')) {
      throw new Error('FIREBASE_API_KEY is not valid.');
    }
    throw tokenError('Invalid ID token.', 'auth/argument-error');
  }

  const account = body.users[0];
  const user = { uid: account.localId, email: account.email, ...account };

  // Cache until the token's own expiry, capped at five minutes.
  let expiresAt = Date.now() + 5 * 60_000;
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp) expiresAt = Math.min(expiresAt, payload.exp * 1000);
  } catch {
    /* keep the default TTL */
  }

  if (userCache.size > 200) userCache.clear();
  userCache.set(idToken, { user, expiresAt });
  return user;
}
