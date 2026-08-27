import { X, LogOut } from 'lucide-react';

export default function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Desktop: centered card */}
      <div className="hidden lg:flex items-center justify-center h-full p-4">
        <div
          className="bg-[#12121b] rounded-2xl border border-white/[0.06] shadow-2xl max-w-sm w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-8 pb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <LogOut size={26} />
            </div>
          </div>
          <div className="text-center px-8 pb-6">
            <h2 className="text-lg font-bold text-white mb-1">Confirm Logout</h2>
            <p className="text-gray-400 text-sm leading-relaxed">Are you sure you want to log out of Prepify?</p>
          </div>
          <div className="flex border-t border-white/[0.06]">
            <button onClick={onClose} className="flex-1 py-3.5 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/[0.03] transition">
              Cancel
            </button>
            <div className="w-px bg-white/[0.06]" />
            <button onClick={onConfirm} className="flex-1 py-3.5 text-sm font-bold text-red-400 hover:bg-red-500/10 transition">
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile + Tablet + iPad: bottom sheet */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0" style={{ animation: 'slideUp 0.25s ease-out' }}>
        <div className="bg-[#12121b] rounded-t-2xl border-t border-white/[0.06] shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/[0.12]" />
          </div>
          <div className="px-6 pt-4 pb-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <LogOut size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white">Confirm Logout</h2>
                <p className="text-gray-400 text-sm mt-0.5 leading-relaxed">Are you sure you want to log out of Prepify?</p>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={onConfirm} className="w-full py-3.5 rounded-xl text-sm font-bold text-red-400 bg-red-500/15 border border-red-500/20 active:scale-[0.98] transition">
                Log Out
              </button>
              <button onClick={onClose} className="w-full py-3.5 rounded-xl text-sm font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] active:scale-[0.98] transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
