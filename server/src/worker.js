/**
 * Cloudflare Workers entry point.
 *
 * The Express app is unchanged - `cloudflare:node` exposes it through the
 * Node.js HTTP server compatibility layer. Only the Firebase layer differs:
 * `wrangler.jsonc` aliases `firebase-admin/*` to the REST implementations in
 * src/workers/, because the Admin SDK's gRPC client cannot run on Workers.
 *
 * Workers forbid network I/O in the global scope, so the Firestore bootstrap
 * starts on the first request and every request awaits the same promise.
 */
import { httpServerHandler } from 'cloudflare:node';
import { flushStore, initStoreAsync } from './store.js';
import './index.js';

const handler = httpServerHandler({ port: Number(process.env.PORT || 4000) });

const BOOT_TIMEOUT_MS = 20_000;
let booting = null;

/**
 * Boots the store at most once per isolate.
 *
 * If Firestore cannot be reached the request fails with 503 instead of hanging:
 * a request that never returns is impossible to diagnose in production. The
 * promise is cleared on rejection so the next request retries.
 */
async function ensureBooted() {
  if (!booting) {
    booting = initStoreAsync().catch((error) => {
      booting = null;
      throw error;
    });
  }

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore boot timed out.')), BOOT_TIMEOUT_MS);
  });

  try {
    await Promise.race([booting, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env, context) {
    try {
      await ensureBooted();
    } catch (error) {
      console.error('[boot]', error.message);
      return new Response(
        JSON.stringify({ error: 'The school server is starting up. Try again in a moment.' }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const response = await handler.fetch(request, env, context);

    // The in-memory database is flushed asynchronously; keep the isolate alive
    // until those Firestore writes settle so a response never loses a mutation.
    context.waitUntil(flushStore());
    return response;
  },
};
