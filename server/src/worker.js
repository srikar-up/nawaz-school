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

let booting = null;

export default {
  async fetch(request, env, context) {
    booting ??= initStoreAsync();
    await booting;

    const response = await handler.fetch(request, env, context);

    // The in-memory database is flushed asynchronously; keep the isolate alive
    // until those Firestore writes settle so a response never loses a mutation.
    context.waitUntil(flushStore());
    return response;
  },
};
