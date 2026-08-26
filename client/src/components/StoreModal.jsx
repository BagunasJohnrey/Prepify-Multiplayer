import { X, Heart, ShoppingBag } from 'lucide-react';

export default function StoreModal({ isOpen, onClose, user, onBuyHeart }) {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        onClick={onClose}
    >
        <div 
            className="bg-dark-surface p-8 rounded-3xl border border-gray-800 shadow-2xl max-w-sm w-full relative animate-scale-in"
            onClick={(e) => e.stopPropagation()} 
        >
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
                <X size={24} />
            </button>
            
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                <ShoppingBag className="text-neon-purple" /> XP Store
            </h2>
            
            <div className="bg-gray-900/50 p-4 rounded-xl mb-6 text-center border border-gray-800">
                <div className="text-gray-400 text-xs uppercase font-bold tracking-widest mb-1">Current Balance</div>
                <div className="text-3xl font-black text-neon-green">{user?.xp || 0} XP</div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500/20 p-2 rounded-lg text-red-500">
                            <Heart size={24} fill="currentColor" />
                        </div>
                        <div>
                            <div className="font-bold text-white">+1 Heart</div>
                            <div className="text-xs text-gray-400">Restore 1 life instantly</div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onBuyHeart}
                        disabled={user?.xp < 50}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                            (user?.xp || 0) >= 50
                            ? 'bg-neon-blue text-black hover:bg-[#00f3ff] hover:shadow-[0_0_10px_rgba(0,243,255,0.4)]' 
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        50 XP
                    </button>
                </div>
            </div>
            
            <p className="text-center text-gray-500 text-xs mt-6">
                Earn XP by answering quiz questions correctly!
            </p>
        </div>
    </div>
  );
}