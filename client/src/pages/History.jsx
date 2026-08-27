import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Award, Target, TrendingUp, Loader, ChevronLeft, ChevronRight, Search, Filter, X, AlertCircle, AlertTriangle, History as HistoryIcon, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import ConfirmationModal from '../components/ui/ConfirmationModal';

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState({ results: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total_quizzes: 0, total_correct: 0, total_questions: 0, avg_percentage: 0, best_percentage: 0 });
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showRetakeConfirm, setShowRetakeConfirm] = useState(false);

  const fetchHistory = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (search) params.append('search', search);
      if (courseFilter !== 'all') params.append('course', courseFilter);
      if (difficultyFilter !== 'all') params.append('difficulty', difficultyFilter);
      const { data } = await api.get(`/results?${params.toString()}`);
      setHistory(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your quiz history. Please try again.');
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [search, courseFilter, difficultyFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/stats');
      setStats(data);
    } catch (err) {
      // stats failed silently
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [fetchHistory, fetchStats]);

  const handlePageChange = (page) => {
    fetchHistory(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetake = (resultId, quizId) => {
    setSelectedResult({ resultId, quizId });
    setShowRetakeConfirm(true);
  };

  const confirmRetake = () => {
    if (selectedResult) {
      navigate(`/quiz/${selectedResult.quizId}`);
    }
    setShowRetakeConfirm(false);
    setSelectedResult(null);
  };

  const getPercentage = (score, total) => (total ? Math.round((score / total) * 100) : 0);

  const getCourseOptions = () => [...new Set(history.results.map(r => r.course).filter(Boolean))];
  const getDifficultyOptions = () => [...new Set(history.results.map(r => r.difficulty).filter(Boolean))];

  const avgPct = stats.avg_percentage ? parseFloat(stats.avg_percentage).toFixed(1) : '0.0';
  const bestPct = stats.best_percentage ? parseFloat(stats.best_percentage).toFixed(1) : '0.0';

  const ScoreRing = ({ value, passed }) => {
    const r = 18;
    const c = 2 * Math.PI * r;
    const offset = c - (value / 100) * c;
    return (
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="22" cy="22" r={r} fill="none"
            stroke={passed ? '#39ff14' : '#f43f5e'} strokeWidth="4"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${passed ? 'text-neon-green' : 'text-rose-400'}`}>{value}%</span>
      </div>
    );
  };

  return (
    <div className="bg-[#0b0b12] min-h-[calc(100vh-4rem)] relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-blue/10 blur-[100px] rounded-full" />
      </div>
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue shadow-[0_0_30px_rgba(0,243,255,0.15)]">
                <HistoryIcon size={24} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Quiz History</h1>
                <p className="text-sm text-gray-400 mt-0.5">Track your progress and review past attempts</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => navigate('/wrong-answers')} className="border border-white/10 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 w-auto px-4 py-2.5">
                <AlertCircle size={18} /> Review Mistakes
              </Button>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Award, label: 'Quizzes Taken', value: stats.total_quizzes || 0, color: 'text-neon-blue', ring: 'shadow-[0_0_25px_rgba(0,243,255,0.2)]' },
            { icon: Target, label: 'Avg. Accuracy', value: `${avgPct}%`, color: 'text-neon-green', ring: 'shadow-[0_0_25px_rgba(57,255,20,0.2)]' },
            { icon: TrendingUp, label: 'Best Score', value: `${bestPct}%`, color: 'text-yellow-400', ring: 'shadow-[0_0_25px_rgba(250,204,21,0.2)]' },
            { icon: CheckCircle2, label: 'Correct', value: `${stats.total_correct || 0}/${stats.total_questions || 0}`, color: 'text-neon-purple', ring: 'shadow-[0_0_25px_rgba(188,19,254,0.2)]' },
          ].map((s) => (
            <div key={s.label} className="bg-[#12121b] p-5 rounded-2xl border border-white/[0.06] flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] ${s.color} ${s.ring}`}>
                <s.icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white leading-none tracking-tight">{s.value}</p>
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mt-1.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden">
            {/* Search + Toggle row */}
            <div className="flex items-center gap-3 p-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
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
                <Filter size={16} />
                <span className="hidden sm:inline">Filters</span>
                {(courseFilter !== 'all' || difficultyFilter !== 'all') && (
                  <span className="w-2 h-2 rounded-full bg-neon-blue" />
                )}
              </button>
            </div>

            {/* Active filter chips */}
            {(courseFilter !== 'all' || difficultyFilter !== 'all') && (
              <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-0">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Active:</span>
                {courseFilter !== 'all' && (
                  <button
                    onClick={() => setCourseFilter('all')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-neon-purple/10 border border-neon-purple/20 text-neon-purple hover:bg-neon-purple/20 transition"
                  >
                    {courseFilter}
                    <X size={10} />
                  </button>
                )}
                {difficultyFilter !== 'all' && (
                  <button
                    onClick={() => setDifficultyFilter('all')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-neon-green/10 border border-neon-green/20 text-neon-green hover:bg-neon-green/20 transition"
                  >
                    {difficultyFilter}
                    <X size={10} />
                  </button>
                )}
                <button
                  onClick={() => { setCourseFilter('all'); setDifficultyFilter('all'); }}
                  className="text-[11px] text-gray-500 hover:text-rose-400 transition ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Expanded filter panel */}
            {showFilters && (
              <div className="px-4 pb-4 pt-0 border-t border-white/[0.04]">
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Course</label>
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2.5 px-3 text-white text-sm outline-none focus:border-neon-blue/50 transition cursor-pointer"
                    >
                      <option value="all" className="bg-[#1a1a2e]">All</option>
                      {getCourseOptions().map(c => (
                        <option key={c} value={c} className="bg-[#1a1a2e]">{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Difficulty</label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2.5 px-3 text-white text-sm outline-none focus:border-neon-blue/50 transition cursor-pointer"
                    >
                      <option value="all" className="bg-[#1a1a2e]">All</option>
                      {getDifficultyOptions().map(d => (
                        <option key={d} value={d} className="bg-[#1a1a2e]">{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl shadow-black/30">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-white/[0.06] rounded-lg w-3/4 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-white/[0.04] rounded-lg w-1/2 animate-pulse"></div>
                    </div>
                    <div className="h-8 bg-white/[0.04] rounded-lg w-16 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 text-center">
              <div className="p-4 rounded-full bg-rose-500/10 text-rose-400"><AlertTriangle size={32} /></div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Couldn't load history</h3>
                <p className="text-gray-400 text-sm max-w-md">{error}</p>
              </div>
              <Button variant="primary" onClick={() => fetchHistory()} className="mt-2 w-auto px-6">Retry</Button>
            </div>
          ) : history.results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="p-4 rounded-full bg-white/[0.03] text-gray-500"><Award size={36} /></div>
              <h3 className="text-xl font-semibold text-gray-200">No quiz history yet</h3>
              <p className="text-gray-500 max-w-sm">Complete your first quiz to start tracking your progress and accuracy here.</p>
              <Button onClick={() => navigate('/dashboard')} variant="primary" className="w-auto px-6">Browse Quizzes</Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {history.results.map((result) => {
                const percentage = getPercentage(result.score, result.total_questions);
                const passed = percentage >= 60;
                return (
                  <div key={result.id} className="group relative p-5 sm:p-6 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <span className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${passed ? 'bg-neon-green/70' : 'bg-rose-500/70'}`} />
                    <div className="flex-1 min-w-0 pl-2">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">{result.title}</h3>
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${passed ? 'bg-neon-green/15 text-neon-green border border-neon-green/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'}`}>
                          {passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 flex-wrap text-sm text-gray-400">
                        <span className="px-2 py-0.5 text-xs rounded-md bg-white/[0.03] border border-white/[0.06]">{result.course}</span>
                        <span className="px-2 py-0.5 text-xs rounded-md bg-white/[0.03] border border-white/[0.06]">{result.difficulty}</span>
                        <span className="flex items-center gap-1"><Target size={13} /> {result.score}/{result.total_questions}</span>
                        <span className="text-gray-600">•</span>
                        <span>{new Date(result.completed_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 pl-2">
                      <ScoreRing value={percentage} passed={passed} />
                      <Button variant="outline" onClick={() => handleRetake(result.id, result.quiz_id)} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5 w-auto px-4 py-2.5">
                        <RotateCcw size={16} /> Retake
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && history.totalPages > 1 && (
            <div className="p-4 border-t border-white/[0.06]">
              <Pagination currentPage={history.page} totalPages={history.totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showRetakeConfirm}
        onClose={() => { setShowRetakeConfirm(false); setSelectedResult(null); }}
        onConfirm={confirmRetake}
        title="Retake Quiz"
        message="This will start a new attempt. Your previous result will be kept in history."
        confirmText="Start Quiz"
        icon="retake"
        variant="danger"
      />
    </div>
  );
}
