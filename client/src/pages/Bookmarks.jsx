import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bookmark, Trash2 } from 'lucide-react';
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Bookmarked Exams</h1>
              <p className="text-sm text-gray-400 mt-0.5">Your saved quizzes for quick access</p>
            </div>
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
            <div className="grid gap-2.5 p-3 sm:p-5">
              {quizzes.map((quiz) => (
                <div key={quiz.id}
                  onClick={() => handleQuizClick(quiz.id)}
                  className="group bg-[#16161f] rounded-2xl border border-white/[0.06] hover:border-neon-purple/40 hover:bg-[#1a1a26] transition-all cursor-pointer overflow-hidden"
                >
                  {/* Mobile layout */}
                  <div className="sm:hidden p-4">
                    <h3 className="font-semibold text-base text-white leading-snug mb-2 group-hover:text-neon-purple transition">{quiz.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      {quiz.items_count && <span className="font-semibold text-gray-300">{quiz.items_count} Qs</span>}
                      {quiz.items_count && quiz.course && <span className="text-gray-600">·</span>}
                      {quiz.course && <span>{quiz.course}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${quiz.difficulty === 'Hard' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' : quiz.difficulty === 'Medium' ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'}`}>{quiz.difficulty || 'Medium'}</span>
                      <div className="flex items-center gap-1.5">
                        {user?.role === 'admin' && (
                          <Button
                            onClick={(e) => { e.stopPropagation(); setQuizToDelete(quiz.id); }}
                            variant="ghost"
                            size="icon"
                            className="!p-2 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10"
                            title="Delete Quiz"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                        <Button
                          onClick={(e) => handleBookmark(e, quiz.id)}
                          variant="ghost"
                          size="icon"
                          className="!p-2 text-neon-blue hover:bg-neon-blue/10"
                          title="Remove bookmark"
                        >
                          <Bookmark size={16} fill="currentColor" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:flex items-center gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className="font-semibold text-lg text-white truncate group-hover:text-neon-purple transition">{quiz.title}</h3>
                        {quiz.items_count && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] text-gray-400 px-2 py-0.5 rounded border border-white/[0.06]">{quiz.items_count} Qs</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-400 bg-white/[0.03] px-2 py-1 rounded-md border border-white/[0.06]">{quiz.course}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md border border-white/[0.06] bg-white/[0.03] ${quiz.difficulty === 'Hard' ? 'text-rose-400' : quiz.difficulty === 'Medium' ? 'text-yellow-400' : 'text-emerald-400'}`}>{quiz.difficulty || 'Medium'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
                    </div>
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
