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
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
  getState: (staffId, signal) => request('/api/state', { staffId, signal }),

  saveAttendance: (staffId, payload) =>
    request('/api/attendance', { method: 'POST', body: payload, staffId }),

  createStudent: (staffId, payload) =>
    request('/api/students', { method: 'POST', body: payload, staffId }),
  updateStudent: (staffId, id, payload) =>
    request(`/api/students/${id}`, { method: 'PATCH', body: payload, staffId }),
  deleteStudent: (staffId, id) =>
    request(`/api/students/${id}`, { method: 'DELETE', staffId }),
  bulkStudents: (staffId, rows) =>
    request('/api/students/bulk', { method: 'POST', body: { rows }, staffId }),

  createStaff: (staffId, payload) =>
    request('/api/staff', { method: 'POST', body: payload, staffId }),
  updateStaff: (staffId, id, payload) =>
    request(`/api/staff/${id}`, { method: 'PATCH', body: payload, staffId }),
  deleteStaff: (staffId, id) =>
    request(`/api/staff/${id}`, { method: 'DELETE', staffId }),

  createExam: (staffId, payload) =>
    request('/api/exams', { method: 'POST', body: payload, staffId }),
  updateExam: (staffId, id, payload) =>
    request(`/api/exams/${id}`, { method: 'PATCH', body: payload, staffId }),
  deleteExam: (staffId, id) =>
    request(`/api/exams/${id}`, { method: 'DELETE', staffId }),

  assignSubjectTeacher: (staffId, subjectId, assignedStaffId) =>
    request(`/api/subjects/${subjectId}`, {
      method: 'PATCH',
      body: { assignedStaffId },
      staffId,
    }),

  saveTimetableCell: (staffId, payload) =>
    request('/api/timetable', { method: 'PUT', body: payload, staffId }),
  deleteTimetableCell: (staffId, id) =>
    request(`/api/timetable/${id}`, { method: 'DELETE', staffId }),
  updateTimetableSettings: (staffId, payload) =>
    request('/api/timetable/settings', { method: 'PATCH', body: payload, staffId }),

  createAssignment: (staffId, payload) =>
    request('/api/assignments', { method: 'POST', body: payload, staffId }),
  updateAssignment: (staffId, id, payload) =>
    request(`/api/assignments/${id}`, { method: 'PATCH', body: payload, staffId }),
  deleteAssignment: (staffId, id) =>
    request(`/api/assignments/${id}`, { method: 'DELETE', staffId }),

  createAnnouncement: (staffId, payload) =>
    request('/api/announcements', { method: 'POST', body: payload, staffId }),
  updateAnnouncement: (staffId, id, payload) =>
    request(`/api/announcements/${id}`, { method: 'PATCH', body: payload, staffId }),
  deleteAnnouncement: (staffId, id) =>
    request(`/api/announcements/${id}`, { method: 'DELETE', staffId }),

  updateRequest: (staffId, id, payload) =>
    request(`/api/rms/${id}`, { method: 'PATCH', body: payload, staffId }),

  updateMeta: (staffId, payload) =>
    request('/api/meta', { method: 'PATCH', body: payload, staffId }),
  importData: (staffId, payload) =>
    request('/api/import', { method: 'POST', body: payload, staffId }),
  resetDemo: (staffId) =>
    request('/api/reset', { method: 'POST', staffId }),

  eventUrl: (staffId) =>
    `${API_BASE}/api/events?staffId=${encodeURIComponent(staffId)}`,
};

export { API_BASE };
