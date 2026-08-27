import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader, RotateCcw, Eye, EyeOff, BookOpen, X, Search, AlertCircle, CheckCircle, XCircle, Target, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';

export default function WrongAnswers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuizId = searchParams.get('quiz_id');

  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState(initialQuizId || null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [wrongAnswers, setWrongAnswers] = useState({ wrongAnswers: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const searchTimeoutRef = useRef(null);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  }, []);

  // Fetch quizzes with wrong answers
  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/wrong-answers/quizzes');
        setQuizzes(data);
      } catch {
        toast.error('Failed to load quizzes');
      } finally {
        setLoading(false);
      }
    };
    if (!selectedQuizId) fetchQuizzes();
  }, [selectedQuizId]);

  // Fetch wrong answers for selected quiz
  const fetchWrongAnswers = useCallback(async (page = 1) => {
    if (!selectedQuizId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20, quiz_id: selectedQuizId });
      if (debouncedSearch) params.append('search', debouncedSearch);
      const { data } = await api.get(`/wrong-answers?${params.toString()}`);
      setWrongAnswers(data);
      // Find quiz details from the list
      const quiz = quizzes.find(q => q.id === selectedQuizId);
      if (quiz) setSelectedQuiz(quiz);
    } catch {
      toast.error('Failed to load wrong answers');
    } finally {
      setLoading(false);
    }
  }, [selectedQuizId, debouncedSearch, quizzes]);

  useEffect(() => {
    if (selectedQuizId) fetchWrongAnswers(1);
  }, [selectedQuizId, fetchWrongAnswers]);

  useEffect(() => {
    setExpandedItems(new Set());
  }, [selectedQuizId]);

  const handlePageChange = (page) => {
    fetchWrongAnswers(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExpand = (id) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleBackToQuizzes = () => {
    setSelectedQuizId(null);
    setSelectedQuiz(null);
    setSearch('');
    setDebouncedSearch('');
    setWrongAnswers({ wrongAnswers: [], total: 0, page: 1, totalPages: 1 });
  };

  const difficultyColor = (d) => {
    if (d === 'Hard') return 'text-rose-400';
    if (d === 'Medium') return 'text-yellow-400';
    return 'text-emerald-400';
  };

  // Quiz picker view
  if (!selectedQuizId) {
    return (
      <div className="bg-[#0b0b12] min-h-[calc(100vh-4rem)] relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-red-500/8 blur-[100px] rounded-full" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate('/history')} className="text-gray-400 hover:text-white hover:bg-white/5 border border-white/10">
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Wrong Answer Review</h1>
              <p className="text-sm text-gray-400 mt-0.5">Select a quiz to review your mistakes</p>
            </div>
          </div>

          {/* Quiz List */}
          <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                  <BookOpen className="text-red-400" size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Quizzes with Mistakes</h2>
                  <p className="text-xs text-gray-500">{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} to review</p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-[#12121b] p-5 rounded-2xl border border-white/[0.06]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/[0.06] rounded-xl animate-pulse"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-white/[0.06] rounded-lg w-3/4 mb-2 animate-pulse"></div>
                        <div className="h-3 bg-white/[0.04] rounded-lg w-1/2 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : quizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="p-4 rounded-full bg-white/[0.03] text-gray-500"><BookOpen size={36} /></div>
                <h3 className="text-xl font-semibold text-gray-200">No wrong answers yet</h3>
                <p className="text-gray-500 max-w-sm text-sm">Take some quizzes and come back to review your mistakes here.</p>
                <Button onClick={() => navigate('/dashboard')} variant="primary">Take a Quiz</Button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {quizzes.map((quiz) => (
                  <button
                    key={quiz.id}
                    onClick={() => setSelectedQuizId(quiz.id)}
                    className="w-full p-5 text-left hover:bg-white/[0.02] transition-colors group flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-white truncate group-hover:text-neon-blue transition">{quiz.title}</h3>
                        <span className={`text-xs font-bold ${difficultyColor(quiz.difficulty)}`}>{quiz.difficulty}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{quiz.course}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-red-400 font-semibold">{quiz.wrong_count} wrong answer{quiz.wrong_count !== 1 ? 's' : ''}</span>
                        <span className="text-gray-700">·</span>
                        <span>{quiz.attempt_count} attempt{quiz.attempt_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-600 group-hover:text-neon-blue transition shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Wrong answers for selected quiz
  return (
    <div className="bg-[#0b0b12] min-h-[calc(100vh-4rem)] relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-red-500/8 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={handleBackToQuizzes} className="text-gray-400 hover:text-white hover:bg-white/5 border border-white/10">
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.12)]">
              <Target size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">{selectedQuiz?.title || 'Quiz'}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{wrongAnswers.total} wrong answer{wrongAnswers.total !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-[#12121b] p-5 rounded-2xl border border-white/[0.06] mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
              <AlertCircle className="text-red-400" size={22} />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">{wrongAnswers.total}</p>
              <p className="text-gray-500 text-xs mt-0.5">wrong answers in this quiz</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate(`/quiz/${selectedQuizId}`)} variant="primary" size="sm" className="flex items-center gap-2">
              <RotateCcw size={16} /> Retake Quiz
            </Button>
            <Button onClick={handleBackToQuizzes} variant="ghost" size="sm" className="border border-white/10 text-gray-400 hover:text-white hover:bg-white/5">
              All Quizzes
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] mb-6 overflow-hidden">
          <div className="p-4">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-white/[0.03] text-white pl-11 pr-10 py-3 rounded-xl border border-white/[0.06] hover:border-white/[0.12] focus:border-neon-blue outline-none transition text-sm"
              />
              {search && (
                <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Wrong Answers List */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#12121b] p-5 rounded-2xl border border-white/[0.06]">
                  <div className="h-4 bg-white/[0.06] rounded-lg w-3/4 mb-3 animate-pulse"></div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-white/[0.04] rounded-lg w-20 animate-pulse"></div>
                    <div className="h-8 bg-white/[0.04] rounded-lg w-20 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : wrongAnswers.wrongAnswers.length === 0 ? (
            <div className="bg-[#12121b] p-12 rounded-2xl border border-white/[0.06] text-center">
              <div className="p-4 rounded-full bg-white/[0.03] text-gray-500 w-fit mx-auto mb-5">
                <BookOpen size={36} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {search ? 'No matching results' : 'No wrong answers'}
              </h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                {search ? 'Try adjusting your search.' : 'Great job! No mistakes in this quiz.'}
              </p>
            </div>
          ) : (
            <>
              {wrongAnswers.wrongAnswers.map((item, index) => {
                const isExpanded = expandedItems.has(`${item.id}-${index}`);
                return (
                  <div
                    key={`${item.id}-${index}`}
                    className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-white/[0.1] transition-colors"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-white leading-relaxed">
                            {item.question}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-400 flex items-center gap-1">
                          <XCircle size={14} /> Your answer
                        </span>
                        <span className="text-gray-600">·</span>
                        <span className="text-red-300 truncate max-w-[250px]">{item.selected}</span>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
                        <span className="text-xs text-gray-600 font-medium">{formatDate(item.completed_at)}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/quiz/${item.quiz_id}`)}
                            className="text-gray-400 hover:text-white flex items-center gap-1.5"
                          >
                            <RotateCcw size={14} /> Retake
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(`${item.id}-${index}`)}
                            className="flex items-center gap-1.5"
                          >
                            {isExpanded ? (
                              <>
                                <EyeOff size={14} className="text-neon-blue" />
                                <span className="text-neon-blue">Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye size={14} className="text-gray-400" />
                                <span className="text-gray-400">Reveal</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/[0.06] p-5 space-y-3 animate-fade-in">
                        <div className="flex items-start gap-3 p-3.5 bg-green-900/15 border border-green-500/20 rounded-xl">
                          <CheckCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-green-400 font-bold text-xs uppercase tracking-wider block mb-1">Correct Answer</span>
                            <p className="text-green-300 font-medium">{item.correct}</p>
                          </div>
                        </div>

                        {item.explanation && (
                          <div className="p-3.5 bg-blue-900/10 border border-blue-500/15 rounded-xl">
                            <span className="text-blue-400 font-bold text-xs uppercase tracking-wider block mb-1.5">Explanation</span>
                            <p className="text-gray-300 text-sm leading-relaxed">{item.explanation}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {wrongAnswers.totalPages > 1 && (
                <div className="pt-4">
                  <Pagination
                    currentPage={wrongAnswers.page}
                    totalPages={wrongAnswers.totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
