import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface RealTimeSyncProps {
  wsConnected: boolean;
  isFallbackActive: boolean;
  isCircuitBreakerBlocked: boolean;
  lastUpdateSource: 'websocket' | 'supabase' | 'polling';
  newMessagesCount?: number;
  lastSyncTime?: Date | null;
}

export const RealTimeSync: React.FC<RealTimeSyncProps> = ({
  wsConnected,
  isFallbackActive,
  isCircuitBreakerBlocked,
  lastUpdateSource,
  newMessagesCount = 0,
  lastSyncTime
}) => {
  const getStatusInfo = () => {
    if (isCircuitBreakerBlocked) {
      return {
        icon: AlertCircle,
        text: 'Socket Bloqueado • Supabase Ativo',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        iconColor: 'text-orange-600'
      };
    }
    
    if (wsConnected && !isFallbackActive) {
      return {
        icon: Wifi,
        text: 'WebSocket • Conectado',
        color: 'bg-green-100 text-green-800 border-green-200',
        iconColor: 'text-green-600'
      };
    }
    
    if (isFallbackActive || lastUpdateSource === 'supabase') {
      return {
        icon: CheckCircle,
        text: 'Supabase • Ativo',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        iconColor: 'text-blue-600'
      };
    }
    
    return {
      icon: WifiOff,
      text: 'Offline • Polling',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      iconColor: 'text-gray-600'
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge 
        variant="outline" 
        className={`${statusInfo.color} flex items-center gap-1 px-2 py-1`}
      >
        <StatusIcon className={`w-3 h-3 ${statusInfo.iconColor}`} />
        {statusInfo.text}
      </Badge>
      
      {lastUpdateSource && (
        <Badge variant="outline" className="px-2 py-1 text-xs">
          Via {lastUpdateSource === 'websocket' ? 'WS' : lastUpdateSource === 'supabase' ? 'DB' : 'Poll'}
        </Badge>
      )}
      
      {newMessagesCount > 0 && (
        <Badge className="bg-green-500 text-white px-2 py-1 text-xs">
          +{newMessagesCount}
        </Badge>
      )}
      
      {lastSyncTime && (
        <span className="text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {lastSyncTime.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default RealTimeSync;