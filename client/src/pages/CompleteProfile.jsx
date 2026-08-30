import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function CompleteProfile() {
  const { user, setUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  // If profile already complete, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user?.profile_complete) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) return null;
  if (!user) return null;

  const suggestions = [
    user.email?.split('@')[0],
    user.username,
    'quiz_master',
    'study_pro',
  ].filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return toast.error("Please enter a username.");

    setLoading(true);
    try {
      const { data } = await api.post('/auth/complete-profile', { username: username.trim() });
      setUser(data);
      toast.success("Welcome to Prepify! 🎉");
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to set username.");
    } finally {
      setLoading(false);
    }
  };

  const pickSuggestion = (name) => {
    setUsername(name);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="bg-dark-surface p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="bg-neon-blue/10 p-4 rounded-full w-fit mx-auto mb-4">
            <Sparkles className="text-neon-blue" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Choose Your Name</h1>
          <p className="text-gray-400 text-sm">
            Pick a username that other players will see in multiplayer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Username"
            placeholder="e.g. quiz_champion"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <Button
                key={name}
                type="button"
                onClick={() => pickSuggestion(name)}
                variant={username === name ? 'primary' : 'ghost'}
                size="sm"
                className={username === name 
                  ? 'text-neon-blue' 
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                }
              >
                {name}
              </Button>
            ))}
          </div>

          <Button type="submit" isLoading={loading} variant="success">
            <span className="flex items-center gap-2">
              Let's Go <ArrowRight size={18} />
            </span>
          </Button>
        </form>
      </div>
    </div>
  );
}
