
import { useEffect, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useWebSocketMessages = (clientId: string, onMessage: (message: any) => void) => {
  const socketRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 [WS] Iniciando conexão WebSocket para cliente:', clientId);
    mountedRef.current = true;

    const connectWebSocket = () => {
      try {
        // Conectar WebSocket
        const socket = whatsappService.connectSocket();
        socketRef.current = socket;
        
        socket.on('connect', () => {
          console.log('✅ [WS] WebSocket conectado para cliente:', clientId);
          whatsappService.joinClientRoom(clientId);
          
          // Limpar timeout de reconexão se existir
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
        });

        socket.on('disconnect', (reason: string) => {
          console.log('🔌 [WS] WebSocket desconectado:', reason);
          
          // Tentar reconectar após 3 segundos se ainda estiver montado e não foi desconexão manual
          if (mountedRef.current && reason !== 'io client disconnect') {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                console.log('🔄 [WS] Tentando reconectar...');
                connectWebSocket();
              }
            }, 3000);
          }
        });

        socket.on('error', (error: any) => {
          console.error('❌ [WS] Erro no WebSocket:', error);
        });

        // Handler unificado para mensagens
        const handleMessage = (message: any) => {
          if (!mountedRef.current) return;
          
          console.log('📨 [WS] Nova mensagem recebida:', {
            type: 'websocket_message',
            from: message.from || message.chat_id,
            messageId: message.id || message.message_id,
            body: message.body?.substring(0, 50),
            timestamp: message.timestamp
          });
          
          onMessage(message);
        };

        // Registrar múltiplos eventos de mensagem
        const messageEvents = [
          `message_${clientId}`,
          `new_message_${clientId}`,
          `whatsapp_message_${clientId}`,
          `client_message_${clientId}`,
          'message',
          'new_message',
          'whatsapp_message'
        ];

        messageEvents.forEach(event => {
          console.log(`🎧 [WS] Registrando listener: ${event}`);
          socket.on(event, handleMessage);
        });

        // Cleanup function para este socket específico
        return () => {
          console.log('🧹 [WS] Limpando listeners do socket');
          messageEvents.forEach(event => {
            socket.off(event, handleMessage);
          });
        };

      } catch (error) {
        console.error('❌ [WS] Erro ao conectar WebSocket:', error);
        
        // Tentar reconectar após 5 segundos em caso de erro
        if (mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              console.log('🔄 [WS] Reconectando após erro...');
              connectWebSocket();
            }
          }, 5000);
        }
      }
    };

    // Iniciar conexão
    const cleanup = connectWebSocket();

    return () => {
      console.log('🔌 [WS] Desmontando WebSocket para cliente:', clientId);
      mountedRef.current = false;
      
      // Limpar timeout de reconexão
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Executar cleanup se existe
      if (cleanup) {
        cleanup();
      }
      
      // Desconectar socket se ainda existe
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [clientId, onMessage]);

  return { 
    isConnected: !!socketRef.current?.connected 
  };
};
