import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return toast.error('Missing reset token');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="bg-dark-surface p-10 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
        <h1 className="logo-font text-3xl font-black text-neon-blue mb-2 text-center">PREPIFY</h1>

        {!done ? (
          <>
            <div className="text-center mb-6">
              <div className="bg-neon-purple/10 p-4 rounded-full inline-block mb-3"><Lock className="text-neon-purple" size={28} /></div>
              <h2 className="text-xl font-bold text-white">Set New Password</h2>
              <p className="text-gray-400 text-sm mt-1">Choose a new password for your account.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input label="New Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              <Input label="Confirm Password" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
              <Button type="submit" isLoading={loading} variant="primary">Reset Password</Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <CheckCircle className="text-neon-green mx-auto mb-3" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">Password Updated</h2>
            <p className="text-gray-400 text-sm">Redirecting to login...</p>
          </div>
        )}

        <p className="text-gray-500 mt-6 text-center text-sm">
          <Link to="/login" className="text-neon-purple hover:text-white transition font-bold inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
