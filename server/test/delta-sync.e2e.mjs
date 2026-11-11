/**
 * Delta sync against an isolated JSON-backed API.
 *
 *   node server/test/delta-sync.e2e.mjs
 *
 * Proves that:
 *   - bootstrap and `state?include=` return slices, not the whole school;
 *   - SSE change events carry the changed records, not a full refetch;
 *   - `/api/changes?since=` merges revisions and falls back to `full`.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const API = 'http://127.0.0.1:4103';
const API_KEY = fs
  .readFileSync(path.join(SERVER_DIR, '.env'), 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('FIREBASE_API_KEY='))
  ?.slice('FIREBASE_API_KEY='.length);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-delta-'));
const children = [];

function start(command, args, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  children.push(child);
  return child;
}

function stop(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitFor(url, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function signIn() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@nawazschool.edu',
        password: 'admin123',
        returnSecureToken: true,
      }),
    }
  );
  const body = await response.json();
  if (!body.idToken) throw new Error(body.error?.message || 'sign-in failed');
  return body.idToken;
}

function eventReader(reader) {
  let buffer = '';
  const decoder = new TextDecoder();

  return async function readEvent(name, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let event = 'message';
        const data = [];
        block.split(/\r?\n/).forEach((line) => {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
        });
        if (event === name) return data.join('\n');
        continue;
      }
      const remaining = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        reader.read(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out waiting for SSE ${name}`)), remaining)
        ),
      ]);
      if (result.done) throw new Error('SSE stream closed');
      buffer += decoder.decode(result.value, { stream: true });
    }
    throw new Error(`Timed out waiting for SSE ${name}`);
  };
}

const results = [];
let controller = null;

try {
  start(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: '4103',
      DATA_BACKEND: 'json',
      DATA_DIR: dataDir,
      RUNTIME: '',
    },
  });
  await waitFor(`${API}/api/health`);
  const token = await signIn();
  const auth = { Authorization: `Bearer ${token}` };

  const bootstrap = await (await fetch(`${API}/api/bootstrap`, { headers: auth })).json();
  results.push(['bootstrap excludes the student roster', !('students' in bootstrap)]);
  results.push(['bootstrap includes config collections', Array.isArray(bootstrap.staff) && bootstrap.staff.length > 0]);
  results.push(['bootstrap includes permissions', Boolean(bootstrap.permissions)]);

  const slice = await (
    await fetch(`${API}/api/state?include=students,testRecords`, { headers: auth })
  ).json();
  results.push(['state include returns requested slices', Array.isArray(slice.students) && Array.isArray(slice.testRecords)]);
  results.push(['state include omits unrequested collections', !('staff' in slice)]);

  const before = await (await fetch(`${API}/api/state`, { headers: auth })).json();
  const student = before.students[0];
  const revision = before.meta.revision;

  controller = new AbortController();
  const response = await fetch(`${API}/api/events`, {
    headers: { ...auth, Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  results.push(['SSE stream opens', response.ok && Boolean(response.body)]);
  const readEvent = eventReader(response.body.getReader());
  await readEvent('ready');

  const patchResponse = await fetch(`${API}/api/students/${student.id}`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${student.name} Delta` }),
  });
  results.push(['the student update succeeds', patchResponse.status === 200]);

  const change = JSON.parse(await readEvent('change'));
  results.push(['the SSE event is a patch, not a full refetch', change.full !== true]);
  results.push([
    'the SSE event carries the changed student',
    (change.upserts?.students || []).some((entry) => entry.id === student.id),
  ]);
  results.push(['the SSE event includes meta', Boolean(change.meta)]);

  const since = await (
    await fetch(`${API}/api/changes?since=${revision}`, { headers: auth })
  ).json();
  results.push(['the delta endpoint returns the same change', (since.upserts?.students || []).some((entry) => entry.id === student.id)]);
  results.push(['the delta endpoint advances the revision', since.revision === revision + 1]);

  const deleteResponse = await fetch(`${API}/api/students/${student.id}`, {
    method: 'DELETE',
    headers: auth,
  });
  results.push(['the student delete succeeds', deleteResponse.status === 200]);

  const deleted = await (await fetch(`${API}/api/changes?since=${revision}`, { headers: auth })).json();
  results.push(['the merged delta contains a delete', deleted.deletes?.students?.includes(student.id)]);

  const old = await (await fetch(`${API}/api/changes?since=0`, { headers: auth })).json();
  results.push(['a revision older than the journal asks for a full refetch', old.full === true]);
} finally {
  controller?.abort();
  for (const child of children) stop(child);
  await new Promise((resolve) => setTimeout(resolve, 700));
  fs.rmSync(dataDir, { recursive: true, force: true });
}

let pass = true;
for (const [label, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) pass = false;
}
console.log(`RESULT: ${JSON.stringify({ pass, checks: results.length })}`);
process.exit(pass ? 0 : 1);
