import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Check, X, Loader, Layers, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function Flashcards() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [reviewQueue, setReviewQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    api.get(`/quiz/${quizId}`)
      .then(res => {
        const questions = res.data.questions;
        setQuiz(res.data);
        setCards(questions);
        // Start with questions the user previously got wrong in this quiz's results first (spaced repetition focus)
        setReviewQueue(questions.map((_, i) => i));
      })
      .catch(() => {
        toast.error('Failed to load quiz');
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [quizId, navigate]);

  const handleFlip = () => setFlipped(f => !f);

  const markCard = (isKnown) => {
    const idx = reviewQueue[0];
    const newKnown = new Set(known);
    if (isKnown) newKnown.add(idx);
    setKnown(newKnown);

    const nextQueue = reviewQueue.slice(1);
    setReviewQueue(nextQueue);

    if (nextQueue.length === 0) {
      // If there are still unknown cards, review them again (spaced repetition loop)
      const unknown = cards.map((_, i) => i).filter(i => !newKnown.has(i));
      if (unknown.length > 0 && unknown.length < cards.length) {
        setReviewQueue(unknown);
        setCurrentIdx(unknown[0]);
        setFlipped(false);
        toast.success(`Round complete! Reviewing ${unknown.length} card(s) you didn't know.`);
      } else {
        setFinished(true);
      }
    } else {
      setCurrentIdx(nextQueue[0]);
      setFlipped(false);
    }
  };

  const restart = () => {
    setKnown(new Set());
    setReviewQueue(cards.map((_, i) => i));
    setCurrentIdx(0);
    setFlipped(false);
    setFinished(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0b0b12] p-4">
      <div className="max-w-3xl mx-auto pt-3">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/[0.06] rounded-xl animate-pulse"></div>
            <div className="h-5 bg-white/[0.06] rounded-lg w-40 animate-pulse"></div>
          </div>
          <div className="h-8 bg-white/[0.06] rounded-lg w-16 animate-pulse"></div>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full mb-6 animate-pulse"></div>
        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-8 flex flex-col items-center justify-center min-h-[300px]">
          <div className="h-4 bg-white/[0.06] rounded-lg w-32 mb-4 animate-pulse"></div>
          <div className="h-8 bg-white/[0.06] rounded-lg w-64 mb-6 animate-pulse"></div>
          <div className="h-4 bg-white/[0.04] rounded-lg w-48 animate-pulse"></div>
        </div>
      </div>
    </div>
  );

  const totalKnown = known.size;
  const totalCards = cards.length;
  const progress = Math.round((totalKnown / totalCards) * 100);

  if (finished) {
    return (
      <div className="min-h-screen p-6 md:p-12 max-w-2xl mx-auto flex items-center justify-center">
        <div className="bg-dark-surface p-10 rounded-3xl border border-gray-800 shadow-2xl text-center w-full">
          <Layers className="text-neon-purple mx-auto mb-4" size={48} />
          <h1 className="text-3xl font-black text-white mb-2">Study Session Complete!</h1>
          <p className="text-gray-400 mb-2">You've reviewed all {totalCards} cards.</p>
          <p className="text-2xl font-black text-neon-green mb-6">{totalKnown}/{totalCards} mastered</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={restart} variant="outline" className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800">
              <RotateCcw size={18} /> Study Again
            </Button>
            <Button onClick={() => navigate(`/quiz/${quizId}`)} variant="primary" className="bg-neon-blue border-none text-white">
              Take Quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = cards[reviewQueue[0]];

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="justify-start">
          <ArrowLeft size={20} /> Back
        </Button>
        <div className="text-right">
          <p className="text-sm text-gray-400">{quiz?.title}</p>
          <p className="text-xs text-neon-green font-bold">{totalKnown}/{totalCards} mastered</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-8">
        <div className="h-full bg-neon-green transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="text-center mb-4 text-gray-400 text-sm">
        Card {reviewQueue.length > 0 ? (totalCards - reviewQueue.length + 1) : totalCards} of {totalCards}
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        className="bg-dark-surface rounded-3xl border border-gray-800 shadow-2xl p-10 min-h-[320px] flex flex-col items-center justify-center cursor-pointer hover:border-neon-purple transition relative"
      >
        <div className="absolute top-4 right-4 text-gray-600">
          {flipped ? <EyeOff size={20} /> : <Eye size={20} />}
        </div>

        {!flipped ? (
          <div className="text-center">
            <span className="text-xs font-bold text-neon-purple uppercase tracking-widest">Question</span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mt-4 leading-relaxed">{currentCard?.question}</h2>
            <p className="text-gray-500 text-sm mt-8">Tap to reveal answer</p>
          </div>
        ) : (
          <div className="text-center w-full">
            <span className="text-xs font-bold text-neon-green uppercase tracking-widest">Answer</span>
            <div className="text-xl font-bold text-neon-green mt-3 mb-4">{currentCard?.answer}</div>
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
              <p className="text-gray-400 text-sm leading-relaxed">{currentCard?.explanation}</p>
            </div>
          </div>
        )}
      </div>

      {flipped && (
        <div className="flex gap-4 justify-center mt-8 animate-fade-in">
          <Button onClick={() => markCard(false)} variant="danger" className="flex-1 max-w-[200px]">
            <X size={18} /> Still Learning
          </Button>
          <Button onClick={() => markCard(true)} variant="success" className="flex-1 max-w-[200px]">
            <Check size={18} /> Got It
          </Button>
        </div>
      )}
    </div>
  );
}
