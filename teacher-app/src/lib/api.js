const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, { method = 'GET', body, staffId, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (staffId) headers['x-staff-id'] = staffId;

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
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
  getState: (staffId, signal) => request('/api/state', { staffId, signal }),
  saveAttendance: (staffId, payload) =>
    request('/api/attendance', { method: 'POST', body: payload, staffId }),
  submitMarks: (staffId, examId, records) =>
    request(`/api/exams/${examId}/marks`, {
      method: 'POST',
      body: { records },
      staffId,
    }),
  updateChapter: (staffId, subjectId, chapterIndex, status) =>
    request(`/api/subjects/${subjectId}/chapters`, {
      method: 'POST',
      body: { chapterIndex, status },
      staffId,
    }),
  createAssignment: (staffId, payload) =>
    request('/api/assignments', { method: 'POST', body: payload, staffId }),
  updateAssignment: (staffId, assignmentId, payload) =>
    request(`/api/assignments/${assignmentId}`, {
      method: 'PATCH',
      body: payload,
      staffId,
    }),
  deleteAssignment: (staffId, assignmentId) =>
    request(`/api/assignments/${assignmentId}`, { method: 'DELETE', staffId }),
  createRequest: (staffId, payload) =>
    request('/api/rms', { method: 'POST', body: payload, staffId }),
  eventUrl: (staffId) =>
    `${API_BASE}/api/events?staffId=${encodeURIComponent(staffId)}`,
};

export { API_BASE };
