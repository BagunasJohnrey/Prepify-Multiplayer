import { X, AlertTriangle, LogOut, RotateCcw, Trash2 } from 'lucide-react';

const iconMap = {
  logout: LogOut,
  retake: RotateCcw,
  delete: Trash2,
  warning: AlertTriangle,
};

const colorMap = {
  danger: { icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  warning: { icon: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  primary: { icon: 'text-neon-blue', bg: 'bg-neon-blue/10', border: 'border-neon-blue/20' },
  success: { icon: 'text-neon-green', bg: 'bg-neon-green/10', border: 'border-neon-green/20' },
};

const confirmColorMap = {
  danger: { text: 'text-red-400', bg: 'bg-red-500/15 border-red-500/20', hover: 'hover:bg-red-500/20' },
  warning: { text: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/20', hover: 'hover:bg-orange-500/20' },
  primary: { text: 'text-neon-blue', bg: 'bg-neon-blue/15 border-neon-blue/20', hover: 'hover:bg-neon-blue/20' },
  success: { text: 'text-neon-green', bg: 'bg-neon-green/15 border-neon-green/20', hover: 'hover:bg-neon-green/20' },
};

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
  icon,
}) {
  if (!isOpen) return null;

  const colors = colorMap[variant] || colorMap.danger;
  const IconComponent = iconMap[icon] || AlertTriangle;
  const confirmColors = confirmColorMap[variant] || confirmColorMap.danger;

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
            <div className={`w-14 h-14 rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.icon}`}>
              <IconComponent size={26} />
            </div>
          </div>
          <div className="text-center px-8 pb-6">
            <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
          </div>
          <div className="flex border-t border-white/[0.06]">
            <button onClick={onClose} disabled={isLoading} className="flex-1 py-3.5 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/[0.03] transition disabled:opacity-50">
              {cancelText}
            </button>
            <div className="w-px bg-white/[0.06]" />
            <button onClick={onConfirm} disabled={isLoading} className={`flex-1 py-3.5 text-sm font-bold ${confirmColors.text} hover:bg-white/[0.03] transition disabled:opacity-50`}>
              {isLoading ? 'Processing...' : confirmText}
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
              <div className={`w-11 h-11 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.icon} shrink-0`}>
                <IconComponent size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white">{title}</h2>
                <p className="text-gray-400 text-sm mt-0.5 leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`w-full py-3.5 rounded-xl text-sm font-bold ${confirmColors.text} ${confirmColors.bg} border active:scale-[0.98] transition disabled:opacity-50`}
              >
                {isLoading ? 'Processing...' : confirmText}
              </button>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] active:scale-[0.98] transition disabled:opacity-50"
              >
                {cancelText}
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
