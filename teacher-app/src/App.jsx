import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import RequireAuth, { ScrollToTop } from './components/RequireAuth';
import TeacherLayout from './components/TeacherLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Attendance from './pages/Attendance';
import AttendanceRegistry from './pages/AttendanceRegistry';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import Tasks from './pages/Tasks';
import MarksEntry from './pages/MarksEntry';
import More from './pages/More';
import Timetable from './pages/Timetable';
import Syllabus from './pages/Syllabus';
import Reports from './pages/Reports';
import Requests from './pages/Requests';
import Notices from './pages/Notices';
import Profile from './pages/Profile';
import StaffDirectory from './pages/StaffDirectory';

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
            <Route element={<TeacherLayout />}>
              <Route index element={<Home />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/attendance/registry" element={<AttendanceRegistry />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/classes/:classId" element={<ClassDetail />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/exams/:examId" element={<MarksEntry />} />
              <Route path="/more" element={<More />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/syllabus" element={<Syllabus />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/notices" element={<Notices />} />
              <Route path="/staff" element={<StaffDirectory />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  );
}
