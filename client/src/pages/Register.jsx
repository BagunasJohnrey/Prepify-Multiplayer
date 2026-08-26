import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api'; 
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Register() {
  const [formData, setFormData] = useState({ username: '', password: '', email: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getGoogleAuthUrl = () => {
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    return `${baseUrl.replace(/\/api$/, '')}/api/auth/google`;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', formData);
      
      toast.success("Account created! Please log in.", { duration: 3000 });
      
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed. Username may already exist.", { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="bg-dark-surface p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
        <h1 className="text-4xl font-black text-white mb-2 text-center">Create Account</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Join the Prepify community today.</p>

        {/* Google Sign-Up Button */}
        <a href={getGoogleAuthUrl()} className="block w-full">
          <button type="button" className="w-full py-3 rounded-xl font-bold border border-gray-700 bg-white text-black hover:bg-gray-100 transition flex items-center justify-center gap-3 shadow-lg cursor-pointer">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>
        </a>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-700"></div>
          <span className="text-gray-500 text-xs font-bold uppercase">or</span>
          <div className="flex-1 h-px bg-gray-700"></div>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <Input 
            label="Username"
            placeholder="Choose a username"
            value={formData.username}
            onChange={e => setFormData({...formData, username: e.target.value})}
          />
          <Input 
            label="Email"
            type="email"
            placeholder="your@email.com"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
          <Input 
            label="Password"
            type="password"
            placeholder="Choose a strong password"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
          
          <Button type="submit" isLoading={loading} variant="success">
            Sign Up
          </Button>
        </form>

        <Link to="/login" className="block text-center mt-6 text-gray-500 hover:text-white transition text-sm">
          Already have an account? <span className="text-neon-blue font-bold">Log In</span>
        </Link>
      </div>
    </div>
  );
}
