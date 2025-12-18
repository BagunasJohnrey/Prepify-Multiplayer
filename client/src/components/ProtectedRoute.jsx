import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from 'lucide-react';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-neon-blue">
        <Loader className="animate-spin w-10 h-10" />
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
