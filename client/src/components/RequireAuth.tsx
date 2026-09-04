import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export default function RequireAuth() {
  const { accessToken } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
