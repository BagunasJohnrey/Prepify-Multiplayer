import { X, LogOut, AlertTriangle } from 'lucide-react';

export default function LogoutModal({ isOpen, onClose, onConfirm }) {
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
            
            <div className="text-center">
                <AlertTriangle className="text-red-500 mx-auto mb-4" size={40} />
                <h2 className="text-2xl font-black text-white mb-2">Confirm Logout</h2>
                <p className="text-gray-400 mb-6 text-sm">
                    Are you sure you want to log out of Prepify?
                </p>
            </div>

            <div className="flex gap-4">
                <button 
                    onClick={onClose}
                    className="w-1/2 py-3.5 rounded-xl font-bold transition-all bg-gray-700 text-white hover:bg-gray-600"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm}
                    className="w-1/2 py-3.5 rounded-xl font-bold transition-all bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2"
                >
                    <LogOut size={20} /> Log Out
                </button>
            </div>
        </div>
    </div>
  );
}