import React from 'react';
import { CheckCircle, Clock, AlertCircle, Loader2, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageStatusIndicatorProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  className?: string;
  showLabel?: boolean;
}

export const MessageStatusIndicator: React.FC<MessageStatusIndicatorProps> = ({
  status,
  className,
  showLabel = false
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'sending':
        return {
          icon: Loader2,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/50',
          label: 'Enviando...',
          spinning: true
        };
      case 'sent':
        return {
          icon: CheckCircle,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          label: 'Enviada',
          spinning: false
        };
      case 'delivered':
        return {
          icon: CheckCheck,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          label: 'Entregue',
          spinning: false
        };
      case 'read':
        return {
          icon: CheckCheck,
          color: 'text-green-600',
          bgColor: 'bg-green-600/10',
          label: 'Lida',
          spinning: false
        };
      case 'failed':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          label: 'Falha',
          spinning: false
        };
      default:
        return {
          icon: Clock,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/50',
          label: 'Pendente',
          spinning: false
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  if (showLabel) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        config.bgColor,
        config.color,
        className
      )}>
        <IconComponent 
          className={cn(
            'w-3 h-3',
            config.spinning && 'animate-spin'
          )} 
        />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <IconComponent 
      className={cn(
        'w-3 h-3',
        config.color,
        config.spinning && 'animate-spin',
        className
      )} 
    />
  );
};