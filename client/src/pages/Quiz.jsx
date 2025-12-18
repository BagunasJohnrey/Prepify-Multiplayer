import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timer, Heart, AlertCircle, CheckCircle, XCircle, Loader, Instagram } from 'lucide-react';
import toast from 'react-hot-toast'; // Import toast
import api from '../utils/api'; 
import { useAuth } from '../context/AuthContext'; 

export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth(); 

  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1200); 
  
  const [selected, setSelected] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [history, setHistory] = useState([]);
  
  // NEW: State for XP animation
  const [showXpGain, setShowXpGain] = useState(false);

  const [hearts, setHearts] = useState(user?.hearts ?? 3);
  const [prevServerHearts, setPrevServerHearts] = useState(user?.hearts);

  if (user?.hearts !== undefined && user.hearts !== prevServerHearts) {
    setPrevServerHearts(user.hearts);
    setHearts(user.hearts);
  }

useEffect(() => {
api.get(`/quiz/${id}`)
  .then(res => {
    // 1. Shuffle questions order
    const shuffledQuestions = res.data.questions.sort(() => Math.random() - 0.5);

    // 2. Shuffle options WITHIN each question
    shuffledQuestions.forEach(q => {
        if (q.options) {
            q.options.sort(() => Math.random() - 0.5);
        }
    });

    const randomized = {
      ...res.data,
      questions: shuffledQuestions
    };
    setQuiz(randomized);
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
        title: quiz.title 
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
      // UPDATED: Replace alert with toast notification for smoother UX
      toast.error("💔 You ran out of lives! Returning to dashboard.");
      navigate('/dashboard');
      return;
    }

    setSelected(option);
    setIsAnswered(true);
    
    const currentQuestion = quiz.questions[currentQ];
    const isCorrect = option === currentQuestion.answer;

    if (isCorrect) {
      setScore(s => s + 1);
      
      // NEW: Trigger XP animation
      setShowXpGain(true);
      setTimeout(() => setShowXpGain(false), 2000);

      // Award XP
      try {
        await api.post('/auth/add-xp', { amount: 10 });
        refreshUser(); 
      } catch (err) {
        console.error("Failed to add XP", err);
      }
    } else {
      setHearts(h => Math.max(0, h - 1)); 
      
      try {
        await api.post('/auth/lose-heart', { userId: user.id });
        refreshUser();
      } catch (err) {
        console.error("Failed to sync hearts", err);
      }
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
      setShowXpGain(false); // Reset animation state

      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } else {
      handleFinish();
    }
  };

  if (!quiz) return (
    <div className="min-h-screen flex items-center justify-center text-neon-blue">
      <Loader className="animate-spin w-10 h-10" />
    </div>
  );

  if (hearts === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-bg p-6 text-center">
      <div className="bg-dark-surface p-10 rounded-3xl border border-gray-800 shadow-2xl max-w-md w-full">
        <Heart size={80} className="text-gray-700 mx-auto mb-6" />
        <h1 className="text-4xl font-black text-red-500 mb-2">OUT OF LIVES</h1>
        <p className="text-gray-400 mb-8">You answered incorrectly too many times. Your hearts will regenerate in 2 minutes.</p>
        
        {/* IMPROVED INSTAGRAM LAYOUT */}
        <div className="mb-8 p-6 bg-gray-900/50 rounded-2xl border border-gray-800 flex flex-col items-center">
            <p className="text-gray-300 font-medium mb-3">Want unlimited lives? ❤️</p>
            <a 
                href="https://www.instagram.com/jarey.xz/?igsh=dGNjcWEyZDhpYjI0#" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-purple-600 to-pink-600 text-white px-6 py-2.5 rounded-full font-bold hover:opacity-90 transition transform hover:scale-105 shadow-lg w-full max-w-[200px]"
            >
                <Instagram size={20} />
                jarey.xz
            </a>
            <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest">DM for access</p>
        </div>

        <button 
          onClick={() => navigate('/dashboard')}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl border border-gray-700 transition"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  const q = quiz.questions[currentQ];

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto flex flex-col justify-center relative">
      
      {/* NEW: XP Gain Animation */}
      {showXpGain && (
        <div className="fixed top-24 right-6 md:right-24 z-50 pointer-events-none animate-bounce">
            <div className="bg-neon-green/20 border border-neon-green text-neon-green font-black px-4 py-2 rounded-full text-xl shadow-[0_0_20px_rgba(57,255,20,0.4)]">
                +10 XP
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="text-xl font-mono text-gray-400">
            Q<span className="text-white font-bold">{currentQ + 1}</span>/{quiz.questions.length}
          </div>
          
          <div className="flex items-center gap-1 bg-gray-800/50 px-3 py-1 rounded-full border border-gray-700">
            {/* UPDATED: If hearts > 10, show text count. Otherwise show icons. */}
            {hearts > 10 ? (
                <div className="flex items-center gap-2 text-white font-bold px-1">
                    <Heart size={18} className="fill-red-500 text-red-500" />
                    <span>{hearts}</span>
                </div>
            ) : (
                [...Array(Math.max(3, hearts))].map((_, i) => (
                  <Heart 
                    key={i} 
                    size={18} 
                    className={i < hearts ? "fill-red-500 text-red-500" : "text-gray-700"} 
                  />
                ))
            )}
          </div>
        </div>

        <div className={`flex items-center gap-2 font-mono text-lg ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-neon-green'}`}>
          <Timer size={20} />
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      </div>

      <div className="bg-dark-surface p-8 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-900">
          <div 
            className="h-full bg-linear-to-r from-neon-blue to-neon-purple transition-all duration-500 ease-out" 
            style={{ width: `${((currentQ + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-10 text-white leading-relaxed mt-4">
          {q.question}
        </h2>

        <div className="grid gap-4">
          {q.options.map((opt, idx) => {
            let baseStyle = "p-5 rounded-2xl text-left border-2 transition-all duration-200 font-medium text-lg flex justify-between items-center";
            let stateStyle = "border-gray-700 hover:border-neon-blue hover:bg-gray-800 text-gray-300";
            
            if (isAnswered) {
              if (opt === q.answer) {
                stateStyle = "border-neon-green bg-green-900/20 text-neon-green"; 
              } else if (opt === selected) {
                stateStyle = "border-red-500 bg-red-900/20 text-red-500"; 
              } else {
                stateStyle = "border-gray-800 opacity-50"; 
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(opt)}
                disabled={isAnswered}
                className={`${baseStyle} ${stateStyle}`}
              >
                {opt}
                {isAnswered && opt === q.answer && <CheckCircle size={20} />}
                {isAnswered && opt === selected && opt !== q.answer && <XCircle size={20} />}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-8 animate-fade-in-up">
            <div className={`p-6 rounded-2xl border mb-6 ${
              selected === q.answer 
                ? 'bg-green-900/10 border-green-900' 
                : 'bg-red-900/10 border-red-900'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-2 text-gray-300">
                <AlertCircle size={18} className="text-neon-blue" /> 
                Explanation
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{q.explanation}</p>
            </div>
            
            <button 
              onClick={handleNext}
              className="w-full bg-linear-to-r from-neon-blue to-blue-600 text-black font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition transform hover:scale-[1.01] active:scale-[0.99]"
            >
              {currentQ + 1 === quiz.questions.length ? 'See Results' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
