import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timer, Heart, AlertCircle, CheckCircle, XCircle, Loader, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ConfirmationModal from '../components/ui/ConfirmationModal';

export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser, setUser } = useAuth(); 

  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1200); 
  
  const [selected, setSelected] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [history, setHistory] = useState([]);
  
  const [showXpGain, setShowXpGain] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const [hearts, setHearts] = useState(user?.hearts ?? 3);
  const [prevServerHearts, setPrevServerHearts] = useState(user?.hearts);

  if (user?.hearts !== undefined && user.hearts !== prevServerHearts) {
    setPrevServerHearts(user.hearts);
    setHearts(user.hearts);
  }

  useEffect(() => {
    api.get(`/quiz/${id}`)
      .then(res => {
        const shuffledQuestions = res.data.questions.sort(() => Math.random() - 0.5);
        shuffledQuestions.forEach(q => {
          if (q.options) q.options.sort(() => Math.random() - 0.5);
        });
        setQuiz({ ...res.data, questions: shuffledQuestions });
      })
      .catch(() => navigate('/dashboard'));
  }, [id, navigate]);

  const handleFinish = useCallback(() => {
    if (!quiz) return;
    navigate('/result', { 
      state: { 
        score, 
        total: quiz.questions.length, 
        history, 
        title: quiz.title,
        quizId: quiz.id
      } 
    });
  }, [quiz, score, history, navigate]);

  useEffect(() => {
    if (!quiz) return;
    if (timeLeft > 0 && !isAnswered) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      handleFinish();
    }
  }, [timeLeft, isAnswered, quiz, handleFinish]);

  const handleAnswer = async (option) => {
    if (isAnswered) return;

    if (hearts <= 0) {
      toast.error("You ran out of hearts! Saving your progress.");
      navigate('/result', {
        state: {
          score,
          total: quiz.questions.length,
          history,
          title: quiz.title,
          quizId: quiz.id,
          incomplete: true
        }
      });
      return;
    }

    setSelected(option);
    setIsAnswered(true);
    
    const currentQuestion = quiz.questions[currentQ];
    const isCorrect = option === currentQuestion.answer;

    if (isCorrect) {
      setScore(s => s + 1);
      setShowXpGain(true);
      setTimeout(() => setShowXpGain(false), 2000);

      try {
        await api.post('/auth/add-xp', { amount: 10 });
        refreshUser(); 
      } catch (err) { /* xp sync failed */ }
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
      setShowXpGain(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleFinish();
    }
  };

  if (!quiz) return (
    <div className="min-h-screen bg-[#0b0b12] p-4">
      <div className="max-w-3xl mx-auto pt-3">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/[0.06] rounded-xl animate-pulse"></div>
            <div className="h-4 bg-white/[0.06] rounded-lg w-16 animate-pulse"></div>
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

  if (hearts === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0b12] p-6">
      <div className="bg-[#12121b] p-10 rounded-3xl border border-white/[0.06] shadow-2xl max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto mb-6">
          <Heart size={40} />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">OUT OF LIVES</h1>
        <p className="text-gray-400 mb-8 text-sm leading-relaxed">You answered incorrectly too many times. Your hearts will regenerate in 2 minutes.</p>
        
        <Button 
          onClick={() => navigate('/dashboard')}
          variant="primary"
          fullWidth
          className="h-12"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );

  const q = quiz.questions[currentQ];
  const progress = ((currentQ + 1) / quiz.questions.length) * 100;

  return (
    <>
      <div className="min-h-screen bg-[#0b0b12] relative">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-blue/8 blur-[100px] rounded-full" />
        </div>

        {/* XP Animation */}
        {showXpGain && (
          <div className="fixed top-24 right-6 z-50 pointer-events-none animate-bounce">
            <div className="bg-neon-green/15 border border-neon-green/30 text-neon-green font-bold px-4 py-2 rounded-xl text-lg shadow-[0_0_20px_rgba(57,255,20,0.2)]">
              +10 XP
            </div>
          </div>
        )}

        <div className="relative max-w-3xl mx-auto px-4 pt-3 pb-6 sm:pt-6 sm:pb-10">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExitModal(true)}
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="text-sm font-mono text-gray-400">
                Q<span className="text-white font-bold">{currentQ + 1}</span>/{quiz.questions.length}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Hearts */}
              <div className="flex items-center gap-1.5">
                {hearts > 10 ? (
                  <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                    <Heart size={16} className="fill-red-500 text-red-500" />
                    <span>{hearts}</span>
                  </div>
                ) : (
                  [...Array(3)].map((_, i) => (
                    <Heart 
                      key={i} 
                      size={16} 
                      className={i < hearts ? "fill-red-500 text-red-500" : "text-gray-700"} 
                    />
                  ))
                )}
              </div>

              {/* Timer */}
              <div className={`flex items-center gap-1.5 font-mono text-sm font-bold px-3 py-1.5 rounded-lg border ${
                timeLeft < 60 
                  ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                  : 'text-neon-green bg-neon-green/10 border-neon-green/20'
              }`}>
                <Timer size={14} />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question card */}
          <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed mb-8">
                {q.question}
              </h2>

              {/* Options */}
              <div className="grid gap-3">
                {q.options.map((opt, idx) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  let optionClass = "bg-white/[0.03] border-white/[0.06] text-white hover:border-white/[0.12] hover:bg-white/[0.05]";
                  
                  if (isAnswered) {
                    if (opt === q.answer) {
                      optionClass = "bg-neon-green/10 border-neon-green/30 text-neon-green";
                    } else if (opt === selected) {
                      optionClass = "bg-red-500/10 border-red-500/30 text-red-400";
                    } else {
                      optionClass = "bg-white/[0.02] border-white/[0.04] text-gray-500 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(opt)}
                      disabled={isAnswered}
                      className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all disabled:cursor-not-allowed active:scale-[0.98] ${optionClass}`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        isAnswered && opt === q.answer
                          ? 'bg-neon-green/20 text-neon-green'
                          : isAnswered && opt === selected
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/[0.06] text-gray-400'
                      }`}>
                        {isAnswered && opt === q.answer ? (
                          <CheckCircle size={16} />
                        ) : isAnswered && opt === selected ? (
                          <XCircle size={16} />
                        ) : (
                          letters[idx]
                        )}
                      </span>
                      <span className="flex-1 text-sm font-medium">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {isAnswered && (
                <div className="mt-6 animate-fade-in">
                  <div className={`p-4 rounded-xl border ${
                    selected === q.answer 
                      ? 'bg-neon-green/5 border-neon-green/20' 
                      : 'bg-red-500/5 border-red-500/20'
                  }`}>
                    <div className="flex items-center gap-2 font-bold mb-2 text-sm text-gray-300">
                      <AlertCircle size={16} className="text-neon-blue" /> 
                      Explanation
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">{q.explanation}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Next button */}
            {isAnswered && (
              <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                <button
                  onClick={handleNext}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  {currentQ + 1 === quiz.questions.length ? 'See Results' : 'Next Question'}
                </button>
              </div>
            )}
          </div>
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
