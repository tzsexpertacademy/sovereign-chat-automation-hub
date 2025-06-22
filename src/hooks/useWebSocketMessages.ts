
import { useEffect, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useWebSocketMessages = (clientId: string, onMessage: (message: any) => void) => {
  const socketRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 [WS] Conectando WebSocket para:', clientId);
    mountedRef.current = true;

    // Conectar WebSocket
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ [WS] WebSocket conectado');
      whatsappService.joinClientRoom(clientId);
    });

    // Listener para mensagens
    const handleMessage = (message: any) => {
      if (!mountedRef.current) return;
      console.log('📨 [WS] Nova mensagem via WebSocket:', message);
      onMessage(message);
    };

    // Registrar eventos de mensagem
    const messageEvents = [
      `message_${clientId}`,
      `new_message_${clientId}`,
      `whatsapp_message_${clientId}`
    ];

    messageEvents.forEach(event => {
      console.log(`🎧 [WS] Registrando evento: ${event}`);
      socket.on(event, handleMessage);
    });

    return () => {
      console.log('🔌 [WS] Desconectando WebSocket');
      mountedRef.current = false;
      
      if (socketRef.current) {
        messageEvents.forEach(event => {
          socketRef.current.off(event, handleMessage);
        });
        socketRef.current.disconnect();
      }
    };
  }, [clientId, onMessage]);

  return { isConnected: !!socketRef.current };
};
