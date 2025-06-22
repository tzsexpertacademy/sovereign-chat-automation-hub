
import { useCallback } from 'react';
import { useRealtimeTickets } from './useRealtimeTickets';
import { useMessageProcessor } from './useMessageProcessor';
import { useWebSocketMessages } from './useWebSocketMessages';

export const useTicketSystem = (clientId: string) => {
  const { tickets, isLoading, reloadTickets } = useRealtimeTickets(clientId);
  const { processNewMessage } = useMessageProcessor(clientId);

  // Callback para processar mensagens do WebSocket
  const handleWebSocketMessage = useCallback(async (message: any) => {
    await processNewMessage(message);
  }, [processNewMessage]);

  // Conectar WebSocket
  const { isConnected } = useWebSocketMessages(clientId, handleWebSocketMessage);

  // Função de debug
  const debugSystem = useCallback(async () => {
    console.log('🔍 [DEBUG] ===== SISTEMA DE TICKETS =====');
    console.log('🔍 [DEBUG] Client ID:', clientId);
    console.log('🔍 [DEBUG] Tickets carregados:', tickets.length);
    console.log('🔍 [DEBUG] WebSocket conectado:', isConnected);
    
    // Forçar reload
    await reloadTickets();
  }, [clientId, tickets.length, isConnected, reloadTickets]);

  return {
    tickets,
    isLoading,
    isConnected,
    reloadTickets,
    debugSystem
  };
};
