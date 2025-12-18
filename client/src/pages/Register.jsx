import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api'; 
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Register() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', formData);
      
      toast.success("Account created! Please log in.", { duration: 3000 });
      
      // UPDATED: Redirect to /login instead of / (About page)
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
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Create Account</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Join the Prepify community today.</p>

        <form onSubmit={handleRegister} className="space-y-5">
          <Input 
            label="Username"
            placeholder="Choose a username"
            value={formData.username}
            onChange={e => setFormData({...formData, username: e.target.value})}
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

        {/* UPDATED: Link points to /login instead of / */}
        <Link to="/login" className="block text-center mt-6 text-gray-500 hover:text-white transition text-sm">
          Already have an account? <span className="text-neon-blue font-bold">Log In</span>
        </Link>
      </div>
    </div>
  );
}
