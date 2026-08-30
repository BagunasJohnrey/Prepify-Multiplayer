import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { toastOnce } from '../utils/toast';
import api from '../utils/api';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toastOnce.error('Please enter your email');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      toastOnce.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="bg-dark-surface p-10 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
        <h1 className="logo-font text-3xl font-black text-neon-blue mb-2 text-center">PREPIFY</h1>

        {!sent ? (
          <>
            <div className="text-center mb-6">
              <div className="bg-neon-blue/10 p-4 rounded-full inline-block mb-3"><Mail className="text-neon-blue" size={28} /></div>
              <h2 className="text-xl font-bold text-white">Reset Password</h2>
              <p className="text-gray-400 text-sm mt-1">Enter your email and we'll send a reset link.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <Button type="submit" isLoading={loading} variant="primary">Send Reset Link</Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="bg-neon-green/10 p-4 rounded-full inline-block mb-3"><Check className="text-neon-green" size={28} /></div>
            <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
            <p className="text-gray-400 text-sm">If an account exists for {email}, a reset link has been sent.</p>
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
