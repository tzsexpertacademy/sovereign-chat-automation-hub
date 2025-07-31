import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Activity, AlertTriangle, Shield, Clock } from 'lucide-react';

interface WebSocketStatusProps {
  isConnected: boolean;
  isFallbackActive: boolean;
  reconnectAttempts: number;
  isCircuitBreakerBlocked?: boolean;
  circuitBreakerUnblockTime?: number;
  className?: string;
}

const WebSocketStatus = ({ 
  isConnected, 
  isFallbackActive, 
  reconnectAttempts,
  isCircuitBreakerBlocked = false,
  circuitBreakerUnblockTime = 0,
  className = '' 
}: WebSocketStatusProps) => {
  const getStatusColor = () => {
    if (isCircuitBreakerBlocked) return 'bg-red-600';
    if (isConnected) return 'bg-green-500';
    if (isFallbackActive) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isCircuitBreakerBlocked) return 'Servidor Indisponível';
    if (isConnected) return 'WebSocket • Recebendo';
    if (isFallbackActive) return 'Supabase • Fallback';
    return 'Desconectado';
  };

  const getStatusIcon = () => {
    if (isCircuitBreakerBlocked) return <Shield className="h-3 w-3" />;
    if (isConnected) return <Wifi className="h-3 w-3" />;
    if (isFallbackActive) return <Activity className="h-3 w-3" />;
    return <WifiOff className="h-3 w-3" />;
  };

  const getRemainingTime = () => {
    if (!isCircuitBreakerBlocked || !circuitBreakerUnblockTime) return null;
    
    const remaining = Math.max(0, circuitBreakerUnblockTime - Date.now());
    const minutes = Math.ceil(remaining / (60 * 1000));
    
    return minutes > 0 ? `${minutes}min` : 'Desbloqueando...';
  };

  const remainingTime = getRemainingTime();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="secondary" 
        className={`text-white text-xs flex items-center gap-1 ${getStatusColor()}`}
      >
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
      
      {/* Estratégia Híbrida: sempre mostrar que envio é via REST */}
      <Badge variant="outline" className="text-xs text-blue-600">
        REST • Enviando
      </Badge>
      
      {/* Circuit Breaker */}
      {isCircuitBreakerBlocked && remainingTime && (
        <Badge variant="destructive" className="text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {remainingTime}
        </Badge>
      )}
      
      {/* Tentativas de reconexão */}
      {reconnectAttempts > 0 && !isConnected && !isCircuitBreakerBlocked && (
        <Badge variant="outline" className="text-xs flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Tentativas: {reconnectAttempts}
        </Badge>
      )}
    </div>
  );
};

export default WebSocketStatus;