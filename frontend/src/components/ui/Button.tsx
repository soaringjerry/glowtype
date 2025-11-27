import { motion } from 'framer-motion';
import { Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode, MouseEventHandler } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'magic' | 'danger';

interface ButtonProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: ButtonVariant;
  className?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  isLoading?: boolean;
}

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  icon: Icon,
  disabled = false,
  isLoading = false
}: ButtonProps) => {
  const baseStyle = "relative overflow-hidden rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-gray-900 text-white shadow-xl hover:bg-gray-800 py-4 px-8 text-lg hover:shadow-2xl hover:shadow-gray-900/20",
    secondary: "bg-white/50 backdrop-blur-md text-gray-700 border border-white/60 shadow-sm hover:bg-white/80 hover:text-gray-900 hover:border-indigo-200 hover:shadow-md py-4 px-6 transition-all duration-300",
    ghost: "text-gray-600 hover:bg-gray-100/50 py-2 px-4 rounded-full",
    magic: "bg-gray-900 text-white border border-indigo-500/30 shadow-lg shadow-indigo-900/20 hover:shadow-indigo-500/40 hover:border-indigo-400 py-4 px-6 relative overflow-hidden",
    danger: "bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200 py-3 px-6"
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {variant === 'magic' && (
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />
      )}
      {isLoading ? (
        <Loader2 className="animate-spin" size={20} />
      ) : (
        Icon && <Icon size={20} className={variant === 'magic' ? "text-indigo-200" : "currentColor"} />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
};
