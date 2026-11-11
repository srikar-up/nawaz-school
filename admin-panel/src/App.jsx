import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import RequireAuth, { ScrollToTop } from './components/RequireAuth';
import AdminShell from './components/AdminShell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Attendance from './pages/Attendance';
import AttendanceRegistry from './pages/AttendanceRegistry';
import Students from './pages/Students';
import Staff from './pages/Staff';
import Classes from './pages/Classes';
import Curriculum from './pages/Curriculum';
import Timetable from './pages/Timetable';
import Exams from './pages/Exams';
import Assignments from './pages/Assignments';
import Announcements from './pages/Announcements';
import Requests from './pages/Requests';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const DataExchange = lazy(() => import('./pages/DataExchange'));

const basename =
  import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter basename={basename}>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<AdminShell />}>
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/attendance/registry" element={<AttendanceRegistry />} />
              <Route path="/students" element={<Students />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/curriculum" element={<Curriculum />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/reports" element={<Reports />} />
              <Route
                path="/data"
                element={
                  <Suspense
                    fallback={
                      <div className="admin-loading">
                        <span className="admin-spinner" />
                      </div>
                    }
                  >
                    <DataExchange />
                  </Suspense>
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  );
}
