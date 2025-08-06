import React from 'react';
import { cn } from '@/lib/utils';

interface GlowingButtonProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const GlowingButton: React.FC<GlowingButtonProps> = ({
  children,
  className = "",
  href,
  onClick,
  variant = 'primary',
  size = 'md'
}) => {
  const baseClasses = cn(
    "relative inline-flex items-center justify-center font-semibold transition-all duration-300 group overflow-hidden",
    "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
    "before:translate-x-[-100%] before:transition-transform before:duration-700",
    "hover:before:translate-x-[100%] hover:scale-105 hover:shadow-2xl",
    // Variants
    variant === 'primary' && [
      "bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white",
      "hover:from-purple-600 hover:to-fuchsia-600",
      "shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
    ],
    variant === 'secondary' && [
      "bg-gradient-to-r from-gray-700 to-gray-800 text-white border border-purple-500/20",
      "hover:from-gray-600 hover:to-gray-700 hover:border-purple-500/40",
      "shadow-lg shadow-gray-500/25 hover:shadow-purple-500/20"
    ],
    // Sizes
    size === 'sm' && "px-4 py-2 text-sm rounded-lg",
    size === 'md' && "px-6 py-3 text-base rounded-xl",
    size === 'lg' && "px-8 py-4 text-lg rounded-2xl",
    className
  );

  const Component = href ? 'a' : 'button';
  const props = href 
    ? { href, target: "_blank", rel: "noopener noreferrer" } 
    : { onClick };

  return (
    <Component
      className={baseClasses}
      {...props}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-inherit bg-gradient-to-r from-purple-500 to-fuchsia-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
      
      {/* Content */}
      <span className="relative z-10 flex items-center space-x-2">
        {children}
      </span>
    </Component>
  );
};

export default GlowingButton;