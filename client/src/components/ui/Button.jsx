import { Loader } from 'lucide-react';

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-base gap-2",
  lg: "px-8 py-4 text-lg gap-3",
  icon: "p-2.5",
};

const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed";

export default function Button({ 
  children, 
  isLoading, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  className = '', 
  ...props 
}) {
  const variants = {
    primary: "bg-neon-blue text-black hover:bg-[#00f3ff] hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]",
    success: "bg-neon-green text-black hover:bg-[#39ff14] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]",
    danger: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white bg-transparent",
    ghost: "bg-transparent text-gray-300 hover:text-white hover:bg-white/5",
    game: "border-2 border-gray-700 text-gray-300 hover:border-neon-purple hover:bg-gray-800 bg-gray-900 font-medium text-base p-4",
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const sizeClass = sizeStyles[size] || sizeStyles.md;

  return (
    <button 
      disabled={isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizeClass} ${widthClass} ${isLoading ? '' : ''} ${className}`}
      {...props}
    >
      {isLoading ? <Loader className="animate-spin w-5 h-5" /> : children}
    </button>
  );
}