import { Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore, useAuthStore } from './store';
import { useEffect } from 'react';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
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

import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MyTasksPage from './pages/MyTasksPage';
import UserManagementPage from './pages/UserManagementPage';

const ADMIN_ROLES = ['Admin', 'CEO', 'Manager', 'HR'];

export default function App() {
  const dark = useThemeStore((s) => s.dark);
  const { token, user } = useAuthStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Not logged in – show login/forgot-password only
  if (!token || !user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Employee role → limited routes
  const isAdmin = ADMIN_ROLES.includes(user.role);

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={isAdmin ? '/' : '/my-tasks'} replace />} />
      <Route path="/forgot-password" element={<Navigate to={isAdmin ? '/' : '/my-tasks'} replace />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              {/* Admin/Manager routes */}
              {isAdmin ? (
                <>
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
                  <Route path="/user-management" element={<UserManagementPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/br" element={<BRMeetingsPage />} />
                  <Route path="/br/:id" element={<BRDetailPage />} />
                  <Route path="/br/:id/log-mom" element={<BRLogMOMPage />} />
                  <Route path="/my-tasks" element={<MyTasksPage />} />
                </>
              ) : (
                <>
                  {/* Employee routes – limited */}
                  <Route path="/" element={<Navigate to="/my-tasks" replace />} />
                  <Route path="/my-tasks" element={<MyTasksPage />} />
                </>
              )}
              <Route path="*" element={<Navigate to={isAdmin ? '/' : '/my-tasks'} replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
