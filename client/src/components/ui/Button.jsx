import { Loader } from 'lucide-react';

export default function Button({ children, isLoading, variant = 'primary', className = '', ...props }) {
  const baseStyles = "w-full py-3.5 rounded-xl font-bold transition-all transform active:scale-[0.98] flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-neon-blue text-black hover:bg-[#00f3ff] hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]",
    success: "bg-neon-green text-black hover:bg-[#39ff14] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]",
    danger: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white bg-transparent",
    ghost: "bg-transparent text-gray-300 hover:text-white hover:bg-white/5",
    // NEW VARIANT for Game Options
    game: "border-2 border-gray-700 text-gray-300 hover:border-neon-purple hover:bg-gray-800 bg-gray-900 font-medium text-base p-4",
  };

  return (
    <button 
      disabled={isLoading}
      className={`${baseStyles} ${variants[variant]} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {isLoading ? <Loader className="animate-spin w-5 h-5" /> : children}
    </button>
  );
}