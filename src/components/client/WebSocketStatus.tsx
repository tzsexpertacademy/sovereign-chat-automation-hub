import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Activity, AlertTriangle } from 'lucide-react';

interface WebSocketStatusProps {
  isConnected: boolean;
  isFallbackActive: boolean;
  reconnectAttempts: number;
  className?: string;
}

const WebSocketStatus = ({ 
  isConnected, 
  isFallbackActive, 
  reconnectAttempts,
  className = '' 
}: WebSocketStatusProps) => {
  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500';
    if (isFallbackActive) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isConnected) return 'WebSocket Ativo';
    if (isFallbackActive) return 'Fallback Ativo';
    return 'Desconectado';
  };

  const getStatusIcon = () => {
    if (isConnected) return <Wifi className="h-3 w-3" />;
    if (isFallbackActive) return <Activity className="h-3 w-3" />;
    return <WifiOff className="h-3 w-3" />;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="secondary" 
        className={`text-white text-xs flex items-center gap-1 ${getStatusColor()}`}
      >
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
      
      {reconnectAttempts > 0 && !isConnected && (
        <Badge variant="outline" className="text-xs flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Tentativas: {reconnectAttempts}
        </Badge>
      )}
    </div>
  );
};

export default WebSocketStatus;