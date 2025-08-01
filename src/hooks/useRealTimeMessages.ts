
import { useState, useEffect, useCallback } from 'react';
import { realTimeMessageSync } from '@/services/realTimeMessageSync';
import { smartLogs } from '@/services/smartLogsService';

interface UseRealTimeMessagesProps {
  clientId: string;
  instanceId: string;
  onNewMessage?: (message: any) => void;
  onNewTicket?: (ticket: any) => void;
}

export const useRealTimeMessages = ({
  clientId,
  instanceId,
  onNewMessage,
  onNewTicket
}: UseRealTimeMessagesProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');

  const handleNewMessage = useCallback((message: any) => {
    smartLogs.debug('REALTIME', 'Nova mensagem recebida', { 
      messageId: message.id, 
      senderName: message.sender_name 
    });
    onNewMessage?.(message);
  }, [onNewMessage]);

  const handleNewTicket = useCallback((ticket: any) => {
    smartLogs.info('REALTIME', 'Novo ticket criado', { 
      ticketId: ticket.id, 
      title: ticket.title 
    });
    onNewTicket?.(ticket);
  }, [onNewTicket]);

  const handleConnectionChange = useCallback((status: string) => {
    smartLogs.info('REALTIME', 'Status de conexão alterado', { status });
    setConnectionStatus(status);
    setIsConnected(status === 'connected');
  }, []);

  useEffect(() => {
    if (!clientId || !instanceId) return;

    smartLogs.debug('REALTIME', 'Iniciando tempo real', { clientId, instanceId });

    // Iniciar sistema de tempo real
    realTimeMessageSync.start({
      clientId,
      instanceId,
      onNewMessage: handleNewMessage,
      onNewTicket: handleNewTicket,
      onConnectionChange: handleConnectionChange
    });

    // Cleanup ao desmontar
    return () => {
      smartLogs.debug('REALTIME', 'Parando tempo real');
      realTimeMessageSync.stop();
    };
  }, [clientId, instanceId, handleNewMessage, handleNewTicket, handleConnectionChange]);

  return {
    isConnected,
    connectionStatus,
    startRealTime: () => {
      if (clientId && instanceId) {
        realTimeMessageSync.start({
          clientId,
          instanceId,
          onNewMessage: handleNewMessage,
          onNewTicket: handleNewTicket,
          onConnectionChange: handleConnectionChange
        });
      }
    },
    stopRealTime: () => {
      realTimeMessageSync.stop();
    }
  };
};
