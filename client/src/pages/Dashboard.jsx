import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, BookOpen, Heart, Loader, Trash2, FileText, Plus, Search, Share2, Bookmark, Layers, Download, Zap, Award, TrendingUp, X, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StoreModal from '../components/StoreModal';
import Pagination from '../components/ui/Pagination';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import Button from '../components/ui/Button';
import socket from '../utils/socket';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser, setUser, loading: authLoading } = useAuth();

  const [file, setFile] = useState(null);
  const [config, setConfig] = useState({
    course: 'Major Subject', difficulty: 'Medium', numQuestions: 15,
    customTitle: '', description: '', tags: ''
  });

  const [filter, setFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [tagFilter, setTagFilter] = useState('All');
  const [availableTags, setAvailableTags] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showStore, setShowStore] = useState(false);
  const [timeUntilRegen, setTimeUntilRegen] = useState(null);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchQuizzes = useCallback(async () => {
    setQuizzesLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 5, course: filter });
      if (difficultyFilter !== 'All') params.append('difficulty', difficultyFilter);
      if (tagFilter !== 'All') params.append('tag', tagFilter);
      if (search.trim()) params.append('search', search.trim());
      const { data } = await api.get(`/quizzes?${params.toString()}`);
      if (data.quizzes) { setQuizzes(data.quizzes); setTotalPages(data.totalPages); }
      else { setQuizzes(Array.isArray(data) ? data : []); setTotalPages(1); }
    } catch (err) { /* fetch failed */ }
    finally { setQuizzesLoading(false); }
  }, [filter, difficultyFilter, tagFilter, search, page]);

  useEffect(() => { if (user) fetchQuizzes(); }, [fetchQuizzes, user]);
  useEffect(() => { api.get('/tags').then(({ data }) => setAvailableTags(data)).catch(() => {}); }, []);

  useEffect(() => {
    const streak = searchParams.get('streak');
    const bonus = searchParams.get('bonus');
    if (streak && bonus) {
      toast.success(`🔥 ${streak}-day streak! +${bonus} XP bonus`, { duration: 4000, icon: '⚡' });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  useEffect(() => { setPage(1); }, [filter, difficultyFilter, tagFilter, search]);

  useEffect(() => {
    if (!user) return;
    const eventName = `generateProgress_${user.id}`;
    socket.on(eventName, (data) => setProgress({ current: data.current, total: data.total }));
    return () => socket.off(eventName);
  }, [user]);

  useEffect(() => {
    if (!user || user.hearts >= 3) { setTimeUntilRegen(null); return; }
    const interval = setInterval(() => {
      const lastUpdate = new Date(user.last_heart_update).getTime();
      const now = new Date().getTime();
      const REGEN_TIME = 2 * 60 * 1000;
      const remaining = REGEN_TIME - ((now - lastUpdate) % REGEN_TIME);
      setTimeUntilRegen(remaining);
      if (remaining <= 1000) refreshUser();
    }, 1000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  const formatTime = (ms) => {
    if (!ms) return "";
    const totalSeconds = Math.floor(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
  };

  const handleBuyHeart = async () => {
    const COST = 50;
    if (!user || user.xp < COST) { toast.error("Not enough XP!"); return; }
    const prev = { ...user };
    setUser({ ...user, hearts: user.hearts + 1, xp: user.xp - COST });
    toast.success("Heart purchased! ❤️ -50 XP");
    try { await api.post('/auth/buy-heart'); refreshUser(); }
    catch (err) { setUser(prev); toast.error(err.response?.data?.error || "Failed"); }
  };

  const handleGenerate = async () => {
    if (!file) return toast.error("Please upload a PDF file first.");
    if (!config.customTitle.trim()) return toast.error("Please enter a name for this exam.");
    setLoading(true);
    setProgress({ current: 1, total: Math.ceil(config.numQuestions / 10) });
    const formData = new FormData();
    formData.append('pdfFile', file);
    Object.entries(config).forEach(([k, v]) => formData.append(k, v));
    try {
      const { data } = await api.post('/generate', formData);
      toast.success(`Success! "${data.title}" is ready.`);
      fetchQuizzes(); refreshUser(); setFile(null);
    } catch { toast.error("Error generating quiz. Please try again."); }
    finally { setLoading(false); setProgress({ current: 0, total: 0 }); }
  };

  const handleDelete = (e, quizId) => { e.stopPropagation(); setQuizToDelete(quizId); };
  const confirmDelete = async () => {
    if (!quizToDelete) return;
    setDeleteLoading(true);
    try { await api.delete(`/quiz/${quizToDelete}`); toast.success("Quiz deleted"); setQuizToDelete(null); fetchQuizzes(); }
    catch (err) { toast.error("Failed. " + (err.response?.data?.error || "")); }
    finally { setDeleteLoading(false); }
  };

  const handleQuizClick = (quizId) => {
    if (user.hearts <= 0) { toast.error("💔 You need at least one heart.", { duration: 3000 }); return; }
    navigate(`/quiz/${quizId}`);
  };

  const handleBookmark = async (e, quizId) => {
    e.stopPropagation();
    const bookmarks = user.bookmarked_quizzes || [];
    const isBookmarked = bookmarks.includes(quizId);
    try {
      const { data } = await api.post('/auth/bookmark', { quizId });
      setUser({ ...user, bookmarked_quizzes: data.bookmarked_quizzes });
      toast.success(isBookmarked ? "Removed" : "Saved!");
    } catch { toast.error("Failed"); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  if (!user) return null;
  const level = Math.floor((user.xp || 0) / 100) + 1;

  return (
    <>
      <StoreModal isOpen={showStore} onClose={() => setShowStore(false)} user={user} onBuyHeart={handleBuyHeart} />

      <div className="bg-[#0b0b12] relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-blue/10 blur-[100px] rounded-full" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-3 pb-6 sm:pt-6 sm:pb-10 space-y-5 sm:space-y-8">

          {/* Email Banner */}
          {user.email && !user.email_verified && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 sm:p-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-sm">⚠️</span>
                <p className="text-yellow-200 text-xs sm:text-sm">Please verify your email.</p>
              </div>
              <Button variant="outline" size="sm" onClick={async () => { try { await api.post('/auth/resend-verification'); toast.success('Email sent!'); } catch { toast.error('Failed'); } }}
                className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 text-xs">
                Resend
              </Button>
            </div>
          )}

          {/* Header */}
          <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden">
            {/* Mobile: stacked layout */}
            <div className="sm:hidden">
              {/* Row 1: Avatar + Name + Hearts */}
              <div className="flex items-center gap-3 p-4 pb-3">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm font-bold text-white leading-tight">
                    Welcome, <span className="text-neon-blue">{user.username}</span>
                  </h1>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-0.5">
                    {[...Array(3)].map((_, i) => (
                      <Heart key={i} size={14} className={i < user.hearts ? 'text-red-500 fill-red-500' : 'text-gray-700'} />
                    ))}
                    {user.hearts < 3 && timeUntilRegen && (
                      <span className="text-[9px] text-neon-blue font-mono font-bold animate-pulse ml-0.5">{formatTime(timeUntilRegen)}</span>
                    )}
                    {user.hearts >= 3 && (
                      <span className="text-[9px] text-gray-500 font-bold uppercase ml-0.5">Full</span>
                    )}
                  </div>
                  <button onClick={() => setShowStore(true)} className="w-5 h-5 rounded-full bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue hover:bg-neon-blue/20 transition">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              {/* Row 2: Level + XP + Streak */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-gray-400 font-medium">Lv.{level}</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-neon-blue font-semibold">{user.xp || 0} XP</span>
                  {user.login_streak > 0 && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span className="text-orange-400 font-semibold">🔥{user.login_streak}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop: single row */}
            <div className="hidden sm:flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-white truncate">
                    Welcome, <span className="text-neon-blue">{user.username}</span>
                  </h1>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Lv.{level} · {user.xp || 0} XP
                    {user.login_streak > 0 && <span className="ml-2 text-orange-400">🔥{user.login_streak}</span>}
                  </p>
                </div>
              </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5">
                    {[...Array(3)].map((_, i) => (
                      <Heart key={i} size={14} className={i < user.hearts ? 'text-red-500 fill-red-500' : 'text-gray-700'} />
                    ))}
                    {user.hearts >= 3 && <span className="text-[9px] text-gray-500 font-bold uppercase ml-0.5">Full</span>}
                    {user.hearts < 3 && timeUntilRegen && (
                      <span className="text-[9px] text-neon-blue font-mono font-bold animate-pulse ml-0.5">{formatTime(timeUntilRegen)}</span>
                    )}
                  </div>
                  <Button onClick={() => setShowStore(true)} variant="ghost" size="icon" className="w-7 h-7 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/10">
                    <Plus size={14} />
                  </Button>
                </div>
            </div>

            {/* Stats row — both mobile and desktop */}
            <div className="grid grid-cols-3 border-t border-white/[0.04]">
              {[
                { icon: Zap, label: 'XP', value: user.xp || 0, color: 'text-neon-blue' },
                { icon: Award, label: 'Level', value: level, color: 'text-neon-purple' },
                { icon: TrendingUp, label: 'Quizzes', value: quizzes.length || 0, color: 'text-neon-green' },
              ].map((s) => (
                <div key={s.label} className="py-3 text-center border-r border-white/[0.04] last:border-r-0">
                  <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
                  <p className="text-base font-bold text-white leading-none">{s.value}</p>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Main content: Library first, Generate second */}
          <div className="space-y-5 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-6">

            {/* Library */}
            <div className="sm:col-span-2">
              <div className="bg-[#12121b] rounded-2xl border border-white/[0.06]">
                {/* Search + Filters */}
                <div className="p-3 sm:p-5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-neon-purple/10 rounded-lg border border-neon-purple/20">
                      <BookOpen className="text-neon-purple" size={14} />
                    </div>
                    <h2 className="text-sm font-bold text-white">Your Exams</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search exams..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition"
                      />
                      {searchInput && (
                        <button
                          onClick={() => { setSearchInput(''); setSearch(''); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowFilters(v => !v)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border shrink-0 ${
                        showFilters
                          ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue'
                          : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:text-white hover:border-white/[0.12]'
                      }`}
                    >
                      <SlidersHorizontal size={16} />
                      <span className="hidden sm:inline">Filters</span>
                      {(filter !== 'All' || difficultyFilter !== 'All' || tagFilter !== 'All') && (
                        <span className="w-2 h-2 rounded-full bg-neon-blue" />
                      )}
                    </button>
                  </div>

                  {/* Active filter chips */}
                  {(filter !== 'All' || difficultyFilter !== 'All' || tagFilter !== 'All') && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Active:</span>
                      {filter !== 'All' && (
                        <button
                          onClick={() => setFilter('All')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-neon-purple/10 border border-neon-purple/20 text-neon-purple hover:bg-neon-purple/20 transition"
                        >
                          {filter}
                          <X size={10} />
                        </button>
                      )}
                      {difficultyFilter !== 'All' && (
                        <button
                          onClick={() => setDifficultyFilter('All')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-neon-green/10 border border-neon-green/20 text-neon-green hover:bg-neon-green/20 transition"
                        >
                          {difficultyFilter}
                          <X size={10} />
                        </button>
                      )}
                      {tagFilter !== 'All' && (
                        <button
                          onClick={() => setTagFilter('All')}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 hover:bg-yellow-400/20 transition"
                        >
                          {tagFilter}
                          <X size={10} />
                        </button>
                      )}
                      <button
                        onClick={() => { setFilter('All'); setDifficultyFilter('All'); setTagFilter('All'); }}
                        className="text-[11px] text-gray-500 hover:text-rose-400 transition ml-1"
                      >
                        Clear all
                      </button>
                    </div>
                  )}

                  {/* Expanded filter panel */}
                  {showFilters && (
                    <div className="mt-3 pt-3 border-t border-white/[0.04]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Subject</label>
                          <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2.5 px-3 text-white text-sm outline-none focus:border-neon-blue/50 transition cursor-pointer"
                          >
                            <option value="All" className="bg-[#1a1a2e]">All</option>
                            <option value="General Education" className="bg-[#1a1a2e]">GED</option>
                            <option value="Minor Subject" className="bg-[#1a1a2e]">Minor</option>
                            <option value="Major Subject" className="bg-[#1a1a2e]">Major</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Difficulty</label>
                          <select
                            value={difficultyFilter}
                            onChange={(e) => setDifficultyFilter(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2.5 px-3 text-white text-sm outline-none focus:border-neon-blue/50 transition cursor-pointer"
                          >
                            <option value="All" className="bg-[#1a1a2e]">All</option>
                            <option value="Easy" className="bg-[#1a1a2e]">Easy</option>
                            <option value="Medium" className="bg-[#1a1a2e]">Medium</option>
                            <option value="Hard" className="bg-[#1a1a2e]">Hard</option>
                          </select>
                        </div>
                        {availableTags.length > 0 && (
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Tag</label>
                            <select
                              value={tagFilter}
                              onChange={(e) => setTagFilter(e.target.value)}
                              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2.5 px-3 text-white text-sm outline-none focus:border-neon-blue/50 transition cursor-pointer"
                            >
                              <option value="All" className="bg-[#1a1a2e]">All</option>
                              {availableTags.map((t) => (
                                <option key={t.tag} value={t.tag} className="bg-[#1a1a2e]">{t.tag} ({t.count})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quiz List */}
                {quizzesLoading ? (
                  <div className="divide-y divide-white/[0.04]">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="h-4 bg-white/[0.06] rounded-lg w-3/4 animate-pulse"></div>
                            <div className="h-3 bg-white/[0.04] rounded-lg w-1/2 animate-pulse"></div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="h-4 bg-white/[0.04] rounded w-16 animate-pulse"></div>
                              <div className="h-4 bg-white/[0.04] rounded w-12 animate-pulse"></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="w-7 h-7 bg-white/[0.04] rounded-lg animate-pulse"></div>
                            <div className="w-7 h-7 bg-white/[0.04] rounded-lg animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : quizzes.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3 text-center px-4">
                    <BookOpen size={32} className="text-gray-600" />
                    <h3 className="text-base font-semibold text-gray-300">No exams yet</h3>
                    <p className="text-gray-500 text-sm">Upload a PDF to generate your first exam.</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-white/[0.04]">
                      {quizzes.map((quiz) => {
                        const isBookmarked = (user.bookmarked_quizzes || []).includes(quiz.id);
                        return (
                          <div key={quiz.id} onClick={() => handleQuizClick(quiz.id)} className="p-3 sm:p-4 hover:bg-white/[0.02] transition cursor-pointer">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white truncate">{quiz.title}</h3>
                                {quiz.description && <p className="text-gray-500 text-xs truncate mt-0.5">{quiz.description}</p>}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">{quiz.course}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/[0.06] ${
                                    quiz.difficulty === 'Hard' ? 'text-rose-400' : quiz.difficulty === 'Medium' ? 'text-yellow-400' : 'text-emerald-400'
                                  }`}>{quiz.difficulty}</span>
                                  {quiz.tags?.map((tag) => (
                                    <span key={tag} className="text-[10px] text-neon-purple bg-neon-purple/10 px-1.5 py-0.5 rounded border border-neon-purple/20">#{tag}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {user?.role === 'admin' && (
                                  <button onClick={(e) => handleDelete(e, quiz.id)} className="p-1.5 text-gray-600 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/shared/${quiz.share_id}`); toast.success("Copied!"); }}
                                  className="p-1.5 text-gray-600 hover:text-neon-green rounded-lg hover:bg-neon-green/10 transition">
                                  <Share2 size={14} />
                                </button>
                                <button onClick={(e) => handleBookmark(e, quiz.id)}
                                  className={`p-1.5 rounded-lg transition ${isBookmarked ? 'text-neon-blue bg-neon-blue/10' : 'text-gray-600 hover:text-neon-blue hover:bg-neon-blue/10'}`}>
                                  <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-3 border-t border-white/[0.06]">
                      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Generate Exam */}
            <div className="sm:col-span-1">
              <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] sm:sticky sm:top-20">
                <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                  <div className="p-1.5 bg-neon-green/10 rounded-lg border border-neon-green/20">
                    <Upload className="text-neon-green" size={14} />
                  </div>
                  <h2 className="text-sm font-bold text-white">Generate Exam</h2>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Exam Title *</label>
                    <input type="text" placeholder="e.g. Finals Review" value={config.customTitle}
                      onChange={(e) => setConfig({...config, customTitle: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-neon-blue outline-none transition" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Focus Area</label>
                    <input type="text" placeholder="e.g. Chapter 3" value={config.description}
                      onChange={(e) => setConfig({...config, description: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-neon-blue outline-none transition" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tags</label>
                    <input type="text" placeholder="e.g. midterm" value={config.tags}
                      onChange={(e) => setConfig({...config, tags: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-neon-blue outline-none transition" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Questions</label>
                      <span className="text-neon-green font-mono font-bold text-xs">{config.numQuestions}</span>
                    </div>
                    <input type="range" min="5" max="50" step="1" value={config.numQuestions}
                      onChange={(e) => setConfig({...config, numQuestions: e.target.value})}
                      className="w-full h-1.5 bg-white/[0.06] rounded-lg appearance-none cursor-pointer accent-neon-green" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Difficulty</label>
                      <select value={config.difficulty} onChange={(e) => setConfig({...config, difficulty: e.target.value})}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-2 text-xs text-white focus:border-neon-purple outline-none cursor-pointer">
                        <option>Easy</option><option>Medium</option><option>Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Subject</label>
                      <select value={config.course} onChange={(e) => setConfig({...config, course: e.target.value})}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-2 text-xs text-white focus:border-neon-purple outline-none cursor-pointer">
                        <option value="General Education">GED</option>
                        <option value="Minor Subject">Minor</option>
                        <option value="Major Subject">Major</option>
                      </select>
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-white/[0.08] rounded-xl py-4 text-center relative hover:border-neon-green/40 hover:bg-neon-green/[0.02] transition group cursor-pointer">
                    <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <FileText className="mx-auto mb-1 text-gray-600 group-hover:text-neon-green transition" size={20}/>
                    <p className="text-xs font-medium text-gray-400 group-hover:text-white transition px-2">
                      {file ? <span className="text-neon-green">{file.name}</span> : "Drop PDF Here"}
                    </p>
                    <p className="text-[9px] text-gray-600 uppercase mt-0.5">Max 5MB</p>
                  </div>
                  <Button onClick={handleGenerate} disabled={loading} variant="primary" fullWidth size="sm"
                    className="bg-neon-blue text-black font-bold shadow-lg">
                    {loading ? <span className="flex items-center gap-2"><Loader className="animate-spin" size={14} />Generating...</span> : 'Generate'}
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <ConfirmationModal isOpen={!!quizToDelete} onClose={() => setQuizToDelete(null)} onConfirm={confirmDelete}
        isLoading={deleteLoading} title="Delete Quiz" message="Are you sure? This cannot be undone." confirmText="Delete" icon="delete" variant="danger" />
    </>
  );
}
