import { X, Heart, ShoppingBag, Zap, ArrowRight } from 'lucide-react';
import Button from './ui/Button';

export default function StoreModal({ isOpen, onClose, user, onBuyHeart }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm p-0 lg:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#12121b] w-full lg:max-w-sm lg:rounded-2xl rounded-t-2xl border border-white/[0.06] shadow-2xl relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-purple/10 rounded-xl border border-neon-purple/20">
              <ShoppingBag size={18} className="text-neon-purple" />
            </div>
            <h2 className="text-lg font-bold text-white">XP Store</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition">
            <X size={18} />
          </button>
        </div>

        {/* Balance */}
        <div className="p-5">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Current Balance</p>
            <div className="flex items-center justify-center gap-2">
              <Zap size={22} className="text-neon-blue" />
              <span className="text-3xl font-bold text-neon-blue">{user?.xp || 0}</span>
              <span className="text-sm text-gray-400 font-medium">XP</span>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="px-5 pb-5 space-y-3">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between hover:border-red-500/20 transition">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Heart size={22} className="text-red-500 fill-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">+1 Heart</p>
                <p className="text-xs text-gray-500">Restore 1 life instantly</p>
              </div>
            </div>
            <Button
              onClick={onBuyHeart}
              disabled={user?.xp < 50}
              size="sm"
              variant={user?.xp >= 50 ? 'primary' : 'outline'}
              className={`font-bold px-4 ${user?.xp < 50 ? 'border-white/[0.08] text-gray-500 cursor-not-allowed' : 'bg-neon-green text-black hover:bg-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.2)]'}`}
            >
              <Zap size={14} /> 50 XP
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <p className="text-center text-gray-600 text-xs">
            Earn XP by answering quiz questions correctly!
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @media (min-width: 1024px) {
          .animate-slide-up {
            animation: scale-in 0.2s ease-out;
          }
          @keyframes scale-in {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
