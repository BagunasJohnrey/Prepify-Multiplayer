import { X, Heart, ShoppingBag, Zap, Shield, Crown } from 'lucide-react';
import Button from './ui/Button';

const DEALS = [
  {
    id: 'heart-1',
    icon: Heart,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10 border-red-500/20',
    label: '+1 Heart',
    description: 'Restore 1 life instantly',
    cost: 50,
    popular: false,
  },
  {
    id: 'heart-3',
    icon: Shield,
    iconColor: 'text-neon-blue',
    iconBg: 'bg-neon-blue/10 border-neon-blue/20',
    label: '+3 Hearts',
    description: 'Best for practice sessions',
    cost: 120,
    popular: true,
    savings: 'Save 20%',
  },
  {
    id: 'heart-5',
    icon: Crown,
    iconColor: 'text-neon-purple',
    iconBg: 'bg-neon-purple/10 border-neon-purple/20',
    label: '+5 Hearts',
    description: 'Full refill for marathon study',
    cost: 180,
    popular: false,
    savings: 'Save 40%',
  },
];

export default function StoreModal({ isOpen, onClose, user, onBuyHeart }) {
  if (!isOpen) return null;

  const handleBuy = async (deal) => {
    const times = deal.id === 'heart-1' ? 1 : deal.id === 'heart-3' ? 3 : 5;
    for (let i = 0; i < times; i++) {
      await onBuyHeart();
    }
  };

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
        <div className="p-5 pb-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Current Balance</p>
            <div className="flex items-center justify-center gap-2">
              <Zap size={22} className="text-neon-blue" />
              <span className="text-3xl font-bold text-neon-blue">{user?.xp || 0}</span>
              <span className="text-sm text-gray-400 font-medium">XP</span>
            </div>
          </div>
        </div>

        {/* Deals */}
        <div className="px-5 pb-4 space-y-2.5">
          {DEALS.map((deal) => {
            const Icon = deal.icon;
            const canAfford = (user?.xp || 0) >= deal.cost;
            return (
              <div key={deal.id} className={`relative bg-white/[0.02] border rounded-xl p-4 flex items-center justify-between transition ${deal.popular ? 'border-neon-blue/30' : 'border-white/[0.06]'}`}>
                {deal.savings && (
                  <span className="absolute -top-2.5 right-4 text-[9px] font-bold bg-neon-green text-black px-2 py-0.5 rounded-full">{deal.savings}</span>
                )}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${deal.iconBg}`}>
                    <Icon size={20} className={deal.iconColor} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{deal.label}</p>
                    <p className="text-xs text-gray-500">{deal.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleBuy(deal)}
                  disabled={!canAfford}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                    canAfford
                      ? 'bg-neon-green text-black hover:bg-[#39ff14] shadow-[0_0_12px_rgba(57,255,20,0.15)]'
                      : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] cursor-not-allowed'
                  }`}
                >
                  {deal.cost} XP
                </button>
              </div>
            );
          })}
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
