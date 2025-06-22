
import { useEffect } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useDebugWebSocket = (clientId: string) => {
  useEffect(() => {
    if (!clientId) return;

    console.log('🔧 [DEBUG] Iniciando debug WebSocket para cliente:', clientId);

    const socket = whatsappService.connectSocket();

    // Log de todos os eventos recebidos
    const originalOn = socket.on.bind(socket);
    socket.on = (event: string, listener: any) => {
      const wrappedListener = (...args: any[]) => {
        console.log(`🎧 [DEBUG] Evento recebido: ${event}`, args);
        listener(...args);
      };
      return originalOn(event, wrappedListener);
    };

    // Entrar na sala do cliente
    socket.emit('join-room', clientId);
    console.log('🏠 [DEBUG] Entrando na sala:', clientId);

    // Escutar eventos específicos para debug
    const debugEvents = [
      'connect',
      'disconnect',
      'error',
      'message',
      'new_message',
      'whatsapp_message',
      `message_${clientId}`,
      `new_message_${clientId}`,
      `whatsapp_message_${clientId}`,
      `client_message_${clientId}`
    ];

    debugEvents.forEach(event => {
      socket.on(event, (...args: any[]) => {
        console.log(`📡 [DEBUG] ${event}:`, args);
      });
    });

    return () => {
      console.log('🔧 [DEBUG] Limpando debug WebSocket');
    };
  }, [clientId]);
};
