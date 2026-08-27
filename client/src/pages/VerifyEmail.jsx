import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, Mail } from 'lucide-react';
import api from '../utils/api';
import Button from '../components/ui/Button';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="bg-dark-surface p-10 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl text-center">
        {status === 'verifying' && (
          <>
            <div className="w-12 h-12 bg-neon-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <div className="w-6 h-6 bg-neon-blue/40 rounded-lg"></div>
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Verifying...</h1>
            <p className="text-gray-400">Please wait while we confirm your email.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="text-neon-green mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-black text-neon-green mb-2">Email Verified!</h1>
            <p className="text-gray-400 mb-6">Your account is now fully activated.</p>
            <Button onClick={() => navigate('/login')} variant="primary" className="w-full">Continue to Login</Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="text-red-500 mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-black text-red-500 mb-2">Verification Failed</h1>
            <p className="text-gray-400 mb-6">This link is invalid or has expired.</p>
            <Link to="/login" className="text-neon-purple hover:text-white transition font-bold">Back to Login</Link>
          </>
        )}
      </div>
    </div>
  );
}
