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

  const suggestions = [...new Set([
    user.email?.split('@')[0],
    user.username,
    'quiz_master',
    'study_pro',
  ].filter(Boolean))];

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
          {user.avatar_url ? (
            <img 
              src={user.avatar_url} 
              alt="Google profile" 
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-neon-blue/30"
            />
          ) : (
            <div className="bg-neon-blue/10 p-4 rounded-full w-fit mx-auto mb-4">
              <Sparkles className="text-neon-blue" size={32} />
            </div>
          )}
          <h1 className="text-3xl font-black text-white mb-2">Choose Your Name</h1>
          <p className="text-gray-400 text-sm">
            Pick a username that other players will see in multiplayer.
          </p>
          {user.email && (
            <p className="text-gray-500 text-xs mt-2">
              Signed in as <span className="text-gray-400">{user.email}</span>
            </p>
          )}
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
              <button
                key={name}
                type="button"
                onClick={() => pickSuggestion(name)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  username === name
                    ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/40'
                    : 'bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:border-gray-500 hover:text-white'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <Button type="submit" isLoading={loading} variant="success" fullWidth className="h-12">
            <span className="flex items-center justify-center gap-2">
              Let's Go <ArrowRight size={18} />
            </span>
          </Button>
        </form>
      </div>
    </div>
  );
}
