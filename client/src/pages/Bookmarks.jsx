import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Bookmark, PlayCircle, Loader, Share2, Trash2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ConfirmationModal from '../components/ui/ConfirmationModal';

export default function Bookmarks() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchBookmarks = async () => {
    try {
      const { data } = await api.get('/auth/bookmarks');
      setQuizzes(data);
    } catch {
      toast.error('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookmarks(); }, []);

  const confirmDelete = async () => {
    if (!quizToDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/quiz/${quizToDelete}`);
      toast.success('Quiz deleted');
      setQuizToDelete(null);
      fetchBookmarks();
    } catch (err) {
      toast.error('Failed to delete. ' + (err.response?.data?.error || ''));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBookmark = async (e, quizId) => {
    e.stopPropagation();
    try {
      const { data } = await api.post('/auth/bookmark', { quizId });
      setUser({ ...user, bookmarked_quizzes: data.bookmarked_quizzes });
      toast.success('Removed from bookmarks');
      fetchBookmarks();
    } catch {
      toast.error('Failed to update bookmark');
    }
  };

  const handleQuizClick = (quizId) => {
    if (user.hearts <= 0) {
      toast.error('💔 You need at least one heart to start an exam.', { duration: 3000 });
      return;
    }
    navigate(`/quiz/${quizId}`);
  };

  return (
    <div className="bg-[#0b0b12] relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-blue/10 blur-[100px] rounded-full" />
      </div>
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue shadow-[0_0_30px_rgba(0,243,255,0.15)]">
                <Bookmark size={24} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Bookmarked Exams</h1>
                <p className="text-sm text-gray-400 mt-0.5">Your saved quizzes for quick access</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 w-auto px-4 py-2.5">
              <ArrowLeft size={20} /> Dashboard
            </Button>
          </div>
        </header>

        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl shadow-black/30">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-4 bg-white/[0.06] rounded-lg w-3/4 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-white/[0.04] rounded-lg w-1/2 mb-2 animate-pulse"></div>
                      <div className="flex gap-2">
                        <div className="h-5 bg-white/[0.04] rounded w-16 animate-pulse"></div>
                        <div className="h-5 bg-white/[0.04] rounded w-12 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-7 h-7 bg-white/[0.04] rounded-lg animate-pulse"></div>
                      <div className="w-7 h-7 bg-white/[0.04] rounded-lg animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-20">
              <div className="p-4 rounded-full bg-white/[0.03] text-gray-500 mx-auto mb-4 w-fit"><Bookmark size={40} /></div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No bookmarks yet</h3>
              <p className="text-gray-500 mb-6">Bookmark quizzes from your dashboard to find them here.</p>
              <Button onClick={() => navigate('/dashboard')} variant="primary" className="w-auto px-6">Browse Quizzes</Button>
            </div>
          ) : (
            <div className="grid gap-3 p-5">
              {quizzes.map((quiz) => (
                <div key={quiz.id}
                  onClick={() => handleQuizClick(quiz.id)}
                  className="group bg-[#16161f] p-5 rounded-2xl border border-white/[0.06] hover:border-neon-purple/40 hover:bg-[#1a1a26] transition-all cursor-pointer flex justify-between items-center"
                >
                  <div className="flex-1 mr-4 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-semibold text-lg text-white truncate group-hover:text-neon-purple transition">{quiz.title}</h3>
                      {quiz.items_count && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] text-gray-400 px-2 py-0.5 rounded border border-white/[0.06]">{quiz.items_count} Qs</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 bg-white/[0.03] px-2 py-1 rounded-md border border-white/[0.06]">{quiz.course}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md border border-white/[0.06] bg-white/[0.03] ${quiz.difficulty === 'Hard' ? 'text-rose-400' : quiz.difficulty === 'Medium' ? 'text-yellow-400' : 'text-emerald-400'}`}>{quiz.difficulty || 'Medium'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user?.role === 'admin' && (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); setQuizToDelete(quiz.id); }} 
                        variant="ghost" 
                        size="icon"
                        className="text-gray-500 hover:text-rose-500 hover:bg-rose-500/10" 
                        title="Delete Quiz"
                      >
                        <Trash2 size={18} />
                      </Button>
                    )}
                    <Button 
                      onClick={(e) => handleBookmark(e, quiz.id)} 
                      variant="ghost" 
                      size="icon"
                      className="text-neon-blue hover:bg-neon-blue/10" 
                      title="Remove bookmark"
                    >
                      <Bookmark size={18} fill="currentColor" />
                    </Button>
                    <Button 
                      variant="primary" 
                      size="icon"
                      className="bg-neon-blue text-black hover:bg-[#00d4ff] shadow-[0_0_20px_rgba(0,243,255,0.3)]"
                      title="Start quiz"
                    >
                      <PlayCircle size={22} fill="currentColor" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!quizToDelete}
        onClose={() => setQuizToDelete(null)}
        onConfirm={confirmDelete}
        isLoading={deleteLoading}
        title="Delete Quiz"
        message="Are you sure you want to permanently delete this exam? This action cannot be undone."
        confirmText="Delete"
        icon="delete"
        variant="danger"
      />
    </div>
  );
}
