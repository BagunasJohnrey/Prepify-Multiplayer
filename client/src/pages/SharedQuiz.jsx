import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Timer, Heart, AlertCircle, CheckCircle, XCircle, Loader, Share2, Lock, RotateCcw, ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ConfirmationModal from '../components/ui/ConfirmationModal';

export default function SharedQuiz() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser, setUser } = useAuth();

  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1200);
  const [selected, setSelected] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [history, setHistory] = useState([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Flashcard state for non-users
  const [isFlipped, setIsFlipped] = useState(false);

  const [hearts, setHearts] = useState(user?.hearts ?? 3);
  const [prevServerHearts, setPrevServerHearts] = useState(user?.hearts);
  if (user?.hearts !== undefined && user.hearts !== prevServerHearts) {
    setPrevServerHearts(user.hearts);
    setHearts(user.hearts);
  }

  useEffect(() => {
    api.get(`/shared/${shareId}`)
      .then(res => {
        const shuffledQuestions = res.data.questions.sort(() => Math.random() - 0.5);
        shuffledQuestions.forEach(q => { if (q.options) q.options.sort(() => Math.random() - 0.5); });
        setQuiz({ ...res.data, questions: shuffledQuestions });
      })
      .catch(() => navigate('/'));
  }, [shareId, navigate]);

  useEffect(() => {
    if (!quiz) return;
    if (timeLeft > 0 && !isAnswered && !finished) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !finished) {
      setFinished(true);
    }
  }, [timeLeft, isAnswered, quiz, finished]);

  const handleAnswer = async (option) => {
    if (isAnswered || finished) return;

    if (hearts <= 0) {
      toast.error("You ran out of hearts! Log in later to regenerate.");
      setFinished(true);
      return;
    }

    setSelected(option);
    setIsAnswered(true);
    const currentQuestion = quiz.questions[currentQ];
    const isCorrect = option === currentQuestion.answer;

    if (isCorrect) {
      setScore(s => s + 1);
    } else {
      setHearts(h => Math.max(0, h - 1));
      setUser(u => (u ? { ...u, hearts: Math.max(0, u.hearts - 1) } : u));
      try {
        await api.post('/auth/lose-heart', { userId: user.id });
        refreshUser();
      } catch (err) { /* heart sync failed */ }
    }

    setHistory(prev => [...prev, {
      question: currentQuestion.question,
      selected: option,
      correct: currentQuestion.answer,
      explanation: currentQuestion.explanation,
      isCorrect
    }]);
  };

  const handleNext = () => {
    if (currentQ + 1 < quiz.questions.length) {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setIsAnswered(false);
      setIsFlipped(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setFinished(true);
    }
  };

  useEffect(() => {
    if (finished && user && quiz && !saving) {
      setSaving(true);
      api.post('/results', {
        quizId: quiz.id,
        score,
        total: quiz.questions.length,
        history
      }).catch(() => {});
    }
  }, [finished, user, quiz, saving, score, history]);

  if (!quiz) return (
    <div className="min-h-screen bg-[#0b0b12] p-4">
      <div className="max-w-3xl mx-auto pt-3">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/[0.06] rounded-xl animate-pulse"></div>
            <div>
              <div className="h-5 bg-white/[0.06] rounded-lg w-48 mb-1 animate-pulse"></div>
              <div className="h-3 bg-white/[0.04] rounded-lg w-24 animate-pulse"></div>
            </div>
          </div>
          <div className="h-8 bg-white/[0.06] rounded-lg w-20 animate-pulse"></div>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full mb-6 animate-pulse"></div>
        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-6 sm:p-8">
          <div className="h-6 bg-white/[0.06] rounded-lg w-3/4 mb-8 animate-pulse"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Non-user: Show flashcard view
  if (!user) {
    const q = quiz.questions[currentQ];
    return (
      <div className="min-h-screen bg-[#0b0b12] relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-purple/6 blur-[100px] rounded-full" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 pt-3 pb-6 sm:pt-6 sm:pb-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06] transition">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">{quiz.title}</h1>
                <p className="text-xs text-gray-500">Flashcard Mode</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 bg-neon-purple/10 border border-neon-purple/20 text-neon-purple px-3 py-1.5 rounded-lg text-xs font-bold">
              <Share2 size={14} /> Shared
            </span>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500 font-mono">Card {currentQ + 1} of {quiz.questions.length}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-neon-purple to-neon-blue rounded-full transition-all duration-500" style={{ width: `${((currentQ + 1) / quiz.questions.length) * 100}%` }} />
            </div>
          </div>

          {/* Flashcard */}
          <div className="perspective-1000 mb-6" style={{ perspective: '1000px' }}>
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className={`relative w-full min-h-[300px] cursor-pointer transition-transform duration-500 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front - Question */}
              <div className={`absolute inset-0 bg-[#12121b] rounded-2xl border border-white/[0.06] p-6 sm:p-8 flex flex-col items-center justify-center text-center [backface-visibility:hidden]`}>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Question</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed mb-4">{q.question}</h2>
                <div className="flex items-center gap-2 text-gray-600 text-xs mt-4">
                  <Eye size={14} />
                  <span>Tap to reveal answer</span>
                </div>
              </div>

              {/* Back - Answer */}
              <div className={`absolute inset-0 bg-[#12121b] rounded-2xl border border-neon-green/20 p-6 sm:p-8 flex flex-col items-center justify-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)]`}>
                <span className="text-[10px] font-bold text-neon-green uppercase tracking-widest mb-4">Answer</span>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle size={20} className="text-neon-green" />
                  <span className="text-lg sm:text-xl font-bold text-neon-green">{q.answer}</span>
                </div>
                {q.explanation && (
                  <p className="text-gray-400 text-sm leading-relaxed mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                    {q.explanation}
                  </p>
                )}
                <div className="flex items-center gap-2 text-gray-600 text-xs mt-4">
                  <Eye size={14} />
                  <span>Tap to see question</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => { setCurrentQ(c => Math.max(0, c - 1)); setIsFlipped(false); }}
              disabled={currentQ === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-medium">Previous</span>
            </button>
            <button
              onClick={() => { setCurrentQ(c => c + 1); setIsFlipped(false); }}
              disabled={currentQ === quiz.questions.length - 1}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="text-sm font-medium">Next</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* CTA to take quiz */}
          <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">Ready to test your knowledge?</h3>
            <p className="text-gray-500 text-sm mb-4">Sign up to take the full quiz, track your score, and compete with friends.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/login" className="flex items-center gap-2 bg-neon-blue text-black px-6 py-3 rounded-xl font-bold hover:opacity-90 transition">
                <Lock size={16} /> Log In to Take Quiz
              </Link>
              <Link to="/register" className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] text-white px-6 py-3 rounded-xl font-bold hover:bg-white/[0.1] transition">
                Sign Up Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const percentage = quiz.questions.length ? Math.round((score / quiz.questions.length) * 100) : 0;
  const q = quiz.questions[currentQ];

  if (finished) {
    return (
      <div className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto flex flex-col justify-center bg-[#0b0b12]">
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 bg-neon-purple/20 border border-neon-purple/30 text-neon-purple px-4 py-1.5 rounded-full text-sm font-bold">
            <Share2 size={16} /> Shared Quiz
          </span>
        </div>
        <div className="bg-[#12121b] p-10 rounded-3xl border border-white/[0.06] shadow-2xl text-center">
          <div className="text-6xl font-black mb-2 text-neon-green">{percentage}%</div>
          <p className="text-gray-400 tracking-widest uppercase mb-4">Score: {score}/{quiz.questions.length}</p>
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-8">
            <Heart className="text-red-500 fill-red-500" size={18} /> {hearts} / 3 hearts left
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={() => navigate('/dashboard')} variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
              Dashboard
            </Button>
            <Button onClick={() => navigate('/history')} variant="primary" className="bg-neon-blue text-black hover:opacity-90">
              View History
            </Button>
            <Button
              onClick={() => { setFinished(false); setCurrentQ(0); setScore(0); setHistory([]); setSelected(null); setIsAnswered(false); setTimeLeft(1200); }}
              variant="primary"
              className="bg-neon-blue border-none text-white hover:opacity-90 flex items-center gap-2"
            >
              <RotateCcw size={18} /> Retake
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto flex flex-col relative bg-[#0b0b12]">
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-2 bg-neon-purple/20 border border-neon-purple/30 text-neon-purple px-4 py-1.5 rounded-full text-sm font-bold">
          <Share2 size={16} /> Shared Quiz
        </span>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowExitModal(true)} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06] transition">
            <ArrowLeft size={18} />
          </button>
          <div className="text-sm font-mono text-gray-400">
            Q<span className="text-white font-bold">{currentQ + 1}</span>/{quiz.questions.length}
          </div>
          <div className="flex items-center gap-1.5">
            {hearts > 10 ? (
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <Heart size={16} className="fill-red-500 text-red-500" />
                <span>{hearts}</span>
              </div>
            ) : (
              [...Array(3)].map((_, i) => (
                <Heart key={i} size={16} className={i < hearts ? "fill-red-500 text-red-500" : "text-gray-700"} />
              ))
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-sm font-bold px-3 py-1.5 rounded-lg border ${timeLeft < 60 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-neon-green bg-neon-green/10 border-neon-green/20'}`}>
          <Timer size={14} />
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      </div>

      <div className="mb-6">
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500" style={{ width: `${((currentQ + 1) / quiz.questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed mb-8">{q.question}</h2>
          <div className="grid gap-3">
            {q.options.map((opt, idx) => {
              const letters = ['A', 'B', 'C', 'D'];
              let optionClass = "bg-white/[0.03] border-white/[0.06] text-white hover:border-white/[0.12] hover:bg-white/[0.05]";
              if (isAnswered) {
                if (opt === q.answer) optionClass = "bg-neon-green/10 border-neon-green/30 text-neon-green";
                else if (opt === selected) optionClass = "bg-red-500/10 border-red-500/30 text-red-400";
                else optionClass = "bg-white/[0.02] border-white/[0.04] text-gray-500 opacity-50";
              }
              return (
                <button key={idx} onClick={() => handleAnswer(opt)} disabled={isAnswered} className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all disabled:cursor-not-allowed active:scale-[0.98] ${optionClass}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${isAnswered && opt === q.answer ? 'bg-neon-green/20 text-neon-green' : isAnswered && opt === selected ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.06] text-gray-400'}`}>
                    {isAnswered && opt === q.answer ? <CheckCircle size={16} /> : isAnswered && opt === selected ? <XCircle size={16} /> : letters[idx]}
                  </span>
                  <span className="flex-1 text-sm font-medium">{opt}</span>
                </button>
              );
            })}
          </div>
          {isAnswered && (
            <div className="mt-6 animate-fade-in">
              <div className={`p-4 rounded-xl border ${selected === q.answer ? 'bg-neon-green/5 border-neon-green/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center gap-2 font-bold mb-2 text-sm text-gray-300"><AlertCircle size={16} className="text-neon-blue" /> Explanation</div>
                <p className="text-gray-400 text-sm leading-relaxed">{q.explanation}</p>
              </div>
            </div>
          )}
        </div>
        {isAnswered && (
          <div className="px-6 sm:px-8 pb-6 sm:pb-8">
            <button onClick={handleNext} className="w-full py-4 rounded-xl bg-neon-blue text-black font-bold text-sm hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all">
              {currentQ + 1 === quiz.questions.length ? 'See Results' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    </div>

    <ConfirmationModal
      isOpen={showExitModal}
      onClose={() => setShowExitModal(false)}
      onConfirm={() => navigate('/dashboard')}
      title="Leave Quiz?"
      message="Your progress on this quiz will be lost."
      confirmText="Leave"
      cancelText="Stay"
      icon="warning"
      variant="danger"
    />
    </>
  );
}
