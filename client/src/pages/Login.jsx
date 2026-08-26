import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast'; 
import api from '../utils/api'; 
import { useAuth } from '../context/AuthContext'; 
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false); 
  const navigate = useNavigate();
  const { login } = useAuth(); 

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', formData);
      login(data.user);
      toast.success("Login successful!", { duration: 1500 });
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed. Please check your credentials.", { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="bg-dark-surface p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
        <h1 className="logo-font text-4xl font-black text-neon-blue mb-2 text-center">PREPIFY</h1>
        <p className="text-gray-400 text-center mb-8 font-mono text-sm">AI-POWERED EXAM PREP</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <Input 
            label="Username"
            placeholder="Enter your username"
            value={formData.username}
            onChange={e => setFormData({...formData, username: e.target.value})}
          />
          <Input 
            label="Password"
            type="password" 
            placeholder="Please enter your password"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
          
          <Button type="submit" isLoading={loading} variant="primary">
            Log In
          </Button>
        </form>

        <p className="text-gray-500 mt-6 text-center text-sm">
          Don't have an account? <Link to="/register" className="text-neon-purple hover:text-white transition font-bold">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
