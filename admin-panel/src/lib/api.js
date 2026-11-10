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

  /** EventSource cannot send headers, so the token rides in the query string. */
  eventUrl: async (staffId) => {
    await auth?.authStateReady?.();
    const token = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
    const who = staffId ? `staffId=${encodeURIComponent(staffId)}&` : '';
    return `${API_BASE}/api/events?${who}token=${encodeURIComponent(token)}`;
  },
};

export { API_BASE };
