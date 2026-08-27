import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b12] p-4">
        <div className="max-w-5xl mx-auto pt-3">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/[0.06] rounded-xl animate-pulse"></div>
            <div className="h-5 bg-white/[0.06] rounded-lg w-24 animate-pulse"></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-5">
                <div className="h-4 bg-white/[0.06] rounded-lg w-3/4 mb-3 animate-pulse"></div>
                <div className="h-3 bg-white/[0.04] rounded-lg w-1/2 mb-4 animate-pulse"></div>
                <div className="h-10 bg-white/[0.04] rounded-xl animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
