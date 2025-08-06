/**
 * Monitor visual de conexões realtime
 * Mostra status da conexão e permite reconexão manual
 */

import React from 'react';
import { useRealTimeConnectionMonitor } from '@/hooks/useRealTimeConnectionMonitor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RotateCcw } from 'lucide-react';

interface RealtimeConnectionMonitorProps {
  ticketId: string;
  className?: string;
}

export const RealtimeConnectionMonitor = ({ ticketId, className }: RealtimeConnectionMonitorProps) => {
  const { connectionStatus, forceReconnect } = useRealTimeConnectionMonitor(`ticket-${ticketId}`);

  const getStatusIcon = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return <Wifi className="h-3 w-3" />;
      case 'connecting':
        return <RotateCcw className="h-3 w-3 animate-spin" />;
      default:
        return <WifiOff className="h-3 w-3" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return 'bg-emerald-500';
      case 'connecting':
        return 'bg-amber-500';
      default:
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando';
      case 'error':
        return `Erro (${connectionStatus.reconnectAttempts}/5)`;
      default:
        return 'Desconectado';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="outline" 
        className={`${getStatusColor()} text-white border-transparent`}
      >
        {getStatusIcon()}
        <span className="ml-1 text-xs">{getStatusText()}</span>
      </Badge>

      {connectionStatus.status === 'error' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={forceReconnect}
          className="h-6 px-2 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reconectar
        </Button>
      )}
    </div>
  );
};