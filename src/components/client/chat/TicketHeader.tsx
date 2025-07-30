
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Trash2 } from 'lucide-react';
import WebSocketStatus from '../WebSocketStatus';

interface TicketHeaderProps {
  queueInfo: any;
  onClearHistory: () => void;
  isClearing: boolean;
  messagesCount: number;
  websocketStatus?: {
    isConnected: boolean;
    isFallbackActive: boolean;
    reconnectAttempts: number;
  };
}

const TicketHeader = ({ queueInfo, onClearHistory, isClearing, messagesCount, websocketStatus }: TicketHeaderProps) => {
  if (!queueInfo) return null;

  return (
    <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between text-blue-800">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4" />
        <span className="text-sm font-medium">Fila Ativa: {queueInfo.name}</span>
        {queueInfo.assistants && (
          <Badge variant="secondary" className="text-xs">
            🤖 {queueInfo.assistants.name}
          </Badge>
        )}
        
        {websocketStatus && (
          <WebSocketStatus
            isConnected={websocketStatus.isConnected}
            isFallbackActive={websocketStatus.isFallbackActive}
            reconnectAttempts={websocketStatus.reconnectAttempts}
          />
        )}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onClearHistory}
        disabled={isClearing || messagesCount === 0}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        {isClearing ? (
          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
        {isClearing ? 'Limpando...' : 'Limpar Histórico'}
      </Button>
    </div>
  );
};

export default TicketHeader;
