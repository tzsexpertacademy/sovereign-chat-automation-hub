import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = 'Carregando...', 
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const containerClasses = fullScreen 
    ? 'min-h-screen flex items-center justify-center' 
    : 'flex items-center justify-center p-6';

  return (
    <div className={containerClasses}>
      <div className="text-center space-y-2">
        <Loader2 className={`${sizeClasses[size]} animate-spin mx-auto text-primary`} />
        {text && (
          <p className="text-sm text-muted-foreground">{text}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;