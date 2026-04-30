import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store';

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // User doesn't have required role – redirect to their default page
    if (['Employee', 'User'].includes(user.role)) {
      return <Navigate to="/my-tasks" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
