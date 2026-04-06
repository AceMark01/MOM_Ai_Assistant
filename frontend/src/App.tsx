import { Routes, Route } from 'react-router-dom';
import { useThemeStore } from './store';
import { useEffect } from 'react';

import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import MeetingsPage from './pages/MeetingsPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import ScheduleMeetingPage from './pages/ScheduleMeetingPage';
import LogMOMPage from './pages/LogMOMPage';
import UploadMOMPage from './pages/UploadMOMPage';
import CreateMOMPage from './pages/CreateMOMPage';

import TasksPage from './pages/TasksPage';
import AttendancePage from './pages/AttendancePage';
import UsersPage from './pages/UsersPage';
import NotificationsPage from './pages/NotificationsPage';
import BRMeetingsPage from './pages/BRMeetingsPage';
import BRDetailPage from './pages/BRDetailPage';
import BRLogMOMPage from './pages/BRLogMOMPage';

export default function App() {
  const dark = useThemeStore((s) => s.dark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <Routes>
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/meetings" element={<MeetingsPage />} />
              <Route path="/meetings/:id" element={<MeetingDetailPage />} />
              <Route path="/meetings/:id/log-mom" element={<LogMOMPage />} />
              <Route path="/schedule-meeting" element={<ScheduleMeetingPage />} />
              <Route path="/upload" element={<UploadMOMPage />} />
              <Route path="/create-mom" element={<CreateMOMPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/br" element={<BRMeetingsPage />} />
              <Route path="/br/:id" element={<BRDetailPage />} />
              <Route path="/br/:id/log-mom" element={<BRLogMOMPage />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
