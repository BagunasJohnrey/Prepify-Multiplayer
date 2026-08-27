import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast'; 
import api from '../utils/api'; 
import { useAuth } from '../context/AuthContext'; 
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Lock, User, ArrowRight } from 'lucide-react';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false); 
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth(); 

  const oauthError = searchParams.get('error');
  if (oauthError) {
    const messages = {
      google_denied: "Google sign-in was denied.",
      no_code: "Google sign-in failed. Please try again.",
      token_exchange_failed: "Google authentication failed. Please try again.",
      no_user_data: "Could not retrieve user info from Google.",
      server_error: "Server error during Google sign-in.",
    };
    toast.error(messages[oauthError] || "Google sign-in failed.", { duration: 4000 });
    window.history.replaceState({}, '', '/login');
  }

  const getGoogleAuthUrl = () => {
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    return `${baseUrl.replace(/\/api$/, '')}/api/auth/google`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', formData);
      login(data.user);
      toast.success("Login successful!", { duration: 1500 });
      if (data.streakBonus > 0) {
        setTimeout(() => toast.success(
          `🔥 ${data.loginStreak}-day streak! +${data.streakBonus} XP bonus`, 
          { duration: 4000, icon: '⚡' }
        ), 500);
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed. Please check your credentials.", { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b12] p-4 relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-neon-blue/6 blur-[120px] rounded-full" />
      </div>

      <div className="relative bg-[#12121b] p-8 sm:p-10 rounded-3xl border border-white/[0.06] w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-2">PREPIFY</h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">AI-Powered Exam Prep</p>
        </div>

        <a href={getGoogleAuthUrl()} className="block w-full">
          <Button 
            type="button" 
            variant="outline" 
            size="lg" 
            fullWidth
            className="border-white/[0.1] bg-white/[0.03] text-white hover:bg-white/[0.06] hover:border-white/[0.15]"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </Button>
        </a>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/[0.06]"></div>
          <span className="text-gray-600 text-xs font-bold uppercase">or</span>
          <div className="flex-1 h-px bg-white/[0.06]"></div>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <Input 
            label="Username"
            placeholder="Enter your username"
            icon={<User size={16} className="text-gray-500" />}
            value={formData.username}
            onChange={e => setFormData({...formData, username: e.target.value})}
          />
          <Input 
            label="Password"
            type="password" 
            placeholder="Enter your password"
            icon={<Lock size={16} className="text-gray-500" />}
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
          
          <Button type="submit" isLoading={loading} variant="primary" fullWidth className="h-12">
            Log In <ArrowRight size={16} />
          </Button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <p className="text-gray-500 text-sm">
            Don't have an account? <Link to="/register" className="text-neon-blue hover:text-white transition font-bold">Sign Up</Link>
          </p>
          <p className="text-sm">
            <Link to="/forgot-password" className="text-gray-600 hover:text-gray-400 transition">Forgot password?</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
