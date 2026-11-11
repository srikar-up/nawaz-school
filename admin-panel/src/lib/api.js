import {
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function authHeaders() {
  // Wait for Firebase to restore the persisted session before the first call.
  await auth?.authStateReady?.();
  const user = auth?.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json', ...(await authHeaders()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the school server. Check the connection and try again.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.error || `The school server rejected this request (${response.status}).`
    );
    error.status = response.status;
    error.payload = payload;
    error.errors = payload?.errors;
    throw error;
  }
  return payload;
}

/**
 * Holds a Google credential returned by a previous popup attempt, so the next
 * password sign-in can link it silently. Without this, Firebase's default
 * "one account per email" rule makes Google sign-in fail for every staff member
 * who already has a password: they sign in once, and Google works afterwards.
 */
let pendingGoogleCredential = null;

function googleError(error) {
  switch (error?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return new Error('Google sign-in was cancelled.');
    case 'auth/popup-blocked':
      return new Error('Your browser blocked the Google window. Allow pop-ups and try again.');
    case 'auth/unauthorized-domain':
      return new Error(
        'This site is not authorized for Google sign-in yet. Ask the administrator to add it in Firebase Authentication → Settings → Authorized domains.'
      );
    case 'auth/operation-not-allowed':
      return new Error('Google sign-in is not enabled for this school project yet.');
    case 'auth/account-exists-with-different-credential':
      pendingGoogleCredential = error.credential || null;
      return new Error(
        'This email already uses a password. Sign in with your password once below — Google will be linked automatically, and next time you can skip the password.'
      );
    default:
      return new Error(error?.message || 'Google sign-in failed.');
  }
}

export const api = {
  /** Signs in with Firebase Auth; the ID token is sent as a Bearer header. */
  login: async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    // Complete a Google link left pending by an earlier popup attempt.
    if (pendingGoogleCredential) {
      const pending = pendingGoogleCredential;
      pendingGoogleCredential = null;
      try {
        await linkWithCredential(credential.user, pending);
        await credential.user.getIdToken(true);
      } catch {
        /* already linked, or the provider is gone - password login still works */
      }
    }

    await credential.user.getIdToken();
    return request('/api/me');
  },

  /**
   * Google sign-in. The server matches the Google account's verified email
   * against a staff record; an unknown email is rejected with 403.
   */
  loginWithGoogle: async () => {
    let result;
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      result = await signInWithPopup(auth, provider);
    } catch (error) {
      throw googleError(error);
    }

    try {
      await result.user.getIdToken();
      return await request('/api/me');
    } catch (error) {
      // Not a staff account: do not leave a half-signed-in Google session.
      await signOut(auth).catch(() => {});
      throw error;
    }
  },
  me: () => request('/api/me'),
  logout: () => signOut(auth),

  getState: (_staffId, signal) => request('/api/state', { signal }),

  saveAttendance: (_staffId, payload) => request('/api/attendance', { method: 'POST', body: payload }),

  createStudent: (_staffId, payload) => request('/api/students', { method: 'POST', body: payload }),
  updateStudent: (_staffId, id, payload) =>
    request(`/api/students/${id}`, { method: 'PATCH', body: payload }),
  deleteStudent: (_staffId, id) => request(`/api/students/${id}`, { method: 'DELETE' }),
  bulkStudents: (_staffId, rows) =>
    request('/api/students/bulk', { method: 'POST', body: { rows } }),

  createStaff: (_staffId, payload) => request('/api/staff', { method: 'POST', body: payload }),
  updateStaff: (_staffId, id, payload) =>
    request(`/api/staff/${id}`, { method: 'PATCH', body: payload }),
  deleteStaff: (_staffId, id) => request(`/api/staff/${id}`, { method: 'DELETE' }),

  createExam: (_staffId, payload) => request('/api/exams', { method: 'POST', body: payload }),
  updateExam: (_staffId, id, payload) =>
    request(`/api/exams/${id}`, { method: 'PATCH', body: payload }),
  deleteExam: (_staffId, id) => request(`/api/exams/${id}`, { method: 'DELETE' }),

  assignSubjectTeacher: (_staffId, subjectId, assignedStaffId) =>
    request(`/api/subjects/${subjectId}`, { method: 'PATCH', body: { assignedStaffId } }),

  createCurriculum: (_staffId, payload) =>
    request('/api/curricula', { method: 'POST', body: payload }),
  updateCurriculum: (_staffId, id, payload) =>
    request(`/api/curricula/${id}`, { method: 'PATCH', body: payload }),
  applyCurriculum: (_staffId, id, sections) =>
    request(`/api/curricula/${id}/apply`, { method: 'POST', body: { sections } }),
  deleteCurriculum: (_staffId, id) =>
    request(`/api/curricula/${id}`, { method: 'DELETE' }),

  saveTimetableCell: (_staffId, payload) =>
    request('/api/timetable', { method: 'PUT', body: payload }),
  deleteTimetableCell: (_staffId, id) => request(`/api/timetable/${id}`, { method: 'DELETE' }),
  updateTimetableSettings: (_staffId, payload) =>
    request('/api/timetable/settings', { method: 'PATCH', body: payload }),

  createAssignment: (_staffId, payload) =>
    request('/api/assignments', { method: 'POST', body: payload }),
  updateAssignment: (_staffId, id, payload) =>
    request(`/api/assignments/${id}`, { method: 'PATCH', body: payload }),
  deleteAssignment: (_staffId, id) => request(`/api/assignments/${id}`, { method: 'DELETE' }),

  createAnnouncement: (_staffId, payload) =>
    request('/api/announcements', { method: 'POST', body: payload }),
  updateAnnouncement: (_staffId, id, payload) =>
    request(`/api/announcements/${id}`, { method: 'PATCH', body: payload }),
  deleteAnnouncement: (_staffId, id) => request(`/api/announcements/${id}`, { method: 'DELETE' }),

  updateRequest: (_staffId, id, payload) =>
    request(`/api/rms/${id}`, { method: 'PATCH', body: payload }),

  updateMeta: (_staffId, payload) => request('/api/meta', { method: 'PATCH', body: payload }),
  importData: (_staffId, payload) => request('/api/import', { method: 'POST', body: payload }),
  resetDemo: (_staffId) => request('/api/reset', { method: 'POST' }),

  /* ---- profile photos ---- */
  signCloudinary: (kind, id) =>
    request('/api/auth/cloudinary-sign', { method: 'POST', body: { kind, id } }),
  setPhoto: (kind, id, photo) =>
    request(`/api/${kind}/${id}/photo`, { method: 'PATCH', body: photo }),
  deletePhoto: (kind, id) => request(`/api/${kind}/${id}/photo`, { method: 'DELETE' }),

  /**
   * Live sync over a fetch stream instead of EventSource.
   *
   * EventSource cannot set headers, which used to force the ID token into the
   * query string - and therefore into proxy and server access logs. Fetch can
   * send the normal Authorization header, so the token never appears in a URL.
   *
   * Resolves when the server closes the stream; rejects on network/auth errors.
   */
  streamEvents: async ({ signal, onOpen, onEvent } = {}) => {
    await auth?.authStateReady?.();
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : '';

    const response = await fetch(`${API_BASE}/api/events`, {
      method: 'GET',
      headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
      signal,
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      throw new Error(`Live sync unavailable (${response.status}).`);
    }

    onOpen?.();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseSseBlock(block);
        if (parsed) onEvent?.(parsed);
        boundary = buffer.indexOf('\n\n');
      }
    }
  },
};

/** Reads one SSE block into { event, data }. Comment lines are ignored. */
function parseSseBlock(block) {
  let event = 'message';
  const data = [];

  block.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith(':')) return;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  });

  if (!data.length) return null;
  return { event, data: data.join('\n') };
}

export { API_BASE };
