import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trophy, RotateCcw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function Result() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);

  const percentage = state ? Math.round((state.score / state.total) * 100) : 0;
  const passed = state ? percentage >= 60 : false;
  const incomplete = state?.incomplete;

  useEffect(() => {
    if (state && passed) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [passed, state]);

  useEffect(() => {
    if (state && user && !savedRef.current) {
      savedRef.current = true;
      api.post('/results', {
        quizId: state.quizId,
        score: state.score,
        total: state.total,
        history: state.history
      })
        .then(() => setSaved(true))
        .catch(() => {});
    }
  }, [state, user]);

  if (!state) return (
    <div className="bg-[#0b0b12] flex items-center justify-center">
      <p className="text-gray-400 text-sm">No result data available.</p>
    </div>
  );

  const correctCount = state.history?.filter(h => h.isCorrect).length || 0;
  const wrongCount = state.total - correctCount;

  return (
    <div className="bg-[#0b0b12] relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-purple/8 blur-[100px] rounded-full" />
      </div>
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10 space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(${passed ? '57,255,20' : '239,68,68'},0.12)] ${
            passed ? 'bg-neon-green/10 border border-neon-green/20 text-neon-green' : 'bg-red-500/10 border border-red-500/20 text-red-500'
          }`}>
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{state.title || 'Quiz Result'}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {incomplete ? 'Incomplete — ran out of hearts' : 'Result saved to history'}
            </p>
          </div>
        </div>

        {/* Score Card */}
        <div className={`p-6 rounded-2xl border text-center ${
          passed ? 'bg-neon-green/5 border-neon-green/15' : 'bg-red-500/5 border-red-500/15'
        }`}>
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
            passed ? 'bg-neon-green/10 text-neon-green' : 'bg-red-500/10 text-red-500'
          }`}>
            <span className="text-3xl font-black">{percentage}%</span>
          </div>
          <h2 className={`text-3xl font-black mb-1 ${passed ? 'text-neon-green' : 'text-red-500'}`}>
            {passed ? 'PASSED' : 'FAILED'}
          </h2>
          <p className="text-gray-400 text-sm">
            {correctCount} correct out of {state.total} questions
          </p>

          {/* Stats Row */}
          <div className="flex justify-center gap-6 mt-5 pt-5 border-t border-white/[0.06]">
            <div className="text-center">
              <p className="text-2xl font-bold text-neon-green">{correctCount}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Correct</p>
            </div>
            <div className="w-px bg-white/[0.06]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{wrongCount}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Wrong</p>
            </div>
            <div className="w-px bg-white/[0.06]" />
            <div className="text-center">
              <p className="text-2xl font-bold text-neon-blue">{state.total}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Total</p>
            </div>
          </div>
        </div>

        {/* Question Review */}
        {state.history && state.history.length > 0 && (
          <div className="bg-[#12121b] p-4 rounded-2xl border border-white/[0.06] space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider text-left mb-3">Question Review</p>
            {state.history.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${item.isCorrect ? 'bg-neon-green/5 border-neon-green/15' : 'bg-red-500/5 border-red-500/15'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-bold text-white text-left leading-relaxed">Q{idx + 1}. {item.question}</p>
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${item.isCorrect ? 'bg-neon-green/15 text-neon-green' : 'bg-red-500/15 text-red-400'}`}>
                    {item.isCorrect ? 'Correct' : 'Wrong'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`text-xs px-3 py-1 rounded-lg border ${item.isCorrect ? 'bg-neon-green/10 border-neon-green/20 text-neon-green' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {item.isCorrect ? '✓ ' : '✗ '}{item.selected}
                  </span>
                  {!item.isCorrect && (
                    <span className="text-xs px-3 py-1 rounded-lg bg-neon-green/10 border border-neon-green/20 text-neon-green">
                      ✓ {item.correct}
                    </span>
                  )}
                </div>
                {item.explanation && (
                  <p className="text-xs text-gray-500 leading-relaxed text-left flex items-start gap-1.5">
                    <AlertCircle size={12} className="text-neon-blue mt-0.5 shrink-0" /> {item.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={() => navigate('/dashboard')} variant="outline" fullWidth className="h-12 font-bold border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.03]">
            Dashboard
          </Button>
          <Button onClick={() => navigate(`/quiz/${state.quizId}`)} variant="primary" fullWidth className="h-12 font-bold">
            <RotateCcw size={18} className="mr-2" /> Retake Quiz
          </Button>
        </div>

      </div>
    </div>
  );
}
