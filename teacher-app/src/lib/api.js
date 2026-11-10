import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
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
    throw new Error('Cannot reach the school server. Check your connection and try again.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error || `The school server rejected this request (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  /** Signs in with Firebase Auth; the ID token is sent as a Bearer header. */
  login: async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await credential.user.getIdToken();
    return request('/api/me');
  },
  me: () => request('/api/me'),
  logout: () => signOut(auth),

  getState: (_staffId, signal) => request('/api/state', { signal }),
  saveAttendance: (_staffId, payload) =>
    request('/api/attendance', { method: 'POST', body: payload }),
  submitMarks: (_staffId, examId, records) =>
    request(`/api/exams/${examId}/marks`, { method: 'POST', body: { records } }),
  updateChapter: (_staffId, subjectId, chapterIndex, status) =>
    request(`/api/subjects/${subjectId}/chapters`, {
      method: 'POST',
      body: { chapterIndex, status },
    }),
  createAssignment: (_staffId, payload) =>
    request('/api/assignments', { method: 'POST', body: payload }),
  updateAssignment: (_staffId, assignmentId, payload) =>
    request(`/api/assignments/${assignmentId}`, { method: 'PATCH', body: payload }),
  deleteAssignment: (_staffId, assignmentId) =>
    request(`/api/assignments/${assignmentId}`, { method: 'DELETE' }),
  createRequest: (_staffId, payload) => request('/api/rms', { method: 'POST', body: payload }),

  /* ---- profile photos ---- */
  signCloudinary: (kind, id) =>
    request('/api/auth/cloudinary-sign', { method: 'POST', body: { kind, id } }),
  setPhoto: (kind, id, photo) =>
    request(`/api/${kind}/${id}/photo`, { method: 'PATCH', body: photo }),
  deletePhoto: (kind, id) => request(`/api/${kind}/${id}/photo`, { method: 'DELETE' }),

  /** EventSource cannot send headers, so the token rides in the query string. */
  eventUrl: async (staffId) => {
    await auth?.authStateReady?.();
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
    const who = staffId ? `staffId=${encodeURIComponent(staffId)}&` : '';
    return `${API_BASE}/api/events?${who}token=${encodeURIComponent(token)}`;
  },
};

export { API_BASE };
