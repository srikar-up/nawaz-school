/**
 * CORS policy.
 *
 * The teacher PWA, the admin panel and the API are three separate origins in
 * production, so the API has to allow exactly those two browser origins and
 * nothing else. Requests with no Origin header (curl, server-to-server, the
 * same-origin production preview) are allowed through untouched.
 *
 * Configure with a comma-separated list:
 *   CORS_ORIGINS=https://teacher.example.com,https://admin.example.com
 *
 * Outside production the local dev servers are added automatically so the
 * default `npm run dev` setup keeps working without any .env changes.
 */

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function allowedOrigins() {
  const configured = parseOrigins(process.env.CORS_ORIGINS);
  if (process.env.NODE_ENV === 'production') return configured;
  return [...new Set([...configured, ...DEV_ORIGINS])];
}

export function hasConfiguredOrigins() {
  return parseOrigins(process.env.CORS_ORIGINS).length > 0;
}

/**
 * Builds the cors() delegate.
 *
 * `req.get('host')` is available here, which lets the single-server production
 * preview (API serving /teacher and /admin from its own origin) keep working
 * without adding that origin to the allowlist.
 */
export function corsDelegate(req, callback) {
  const origin = req.get('origin');

  if (!origin) {
    return callback(null, { origin: true });
  }

  const normalized = origin.replace(/\/$/, '');
  const allowlist = allowedOrigins();
  const sameHost = (() => {
    try {
      return new URL(normalized).host === req.get('host');
    } catch {
      return false;
    }
  })();

  return callback(null, {
    origin: allowlist.includes(normalized) || sameHost,
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });
}
