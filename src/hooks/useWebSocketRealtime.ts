import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/hooks/use-toast';

interface WebSocketRealtimeConfig {
  clientId: string;
  instanceId: string;
  onMessage?: (message: any) => void;
  onQRUpdate?: (qr: any) => void;
  onConnectionUpdate?: (status: any) => void;
  onPresenceUpdate?: (presence: any) => void;
  enabled?: boolean;
}

interface WebSocketStatus {
  connected: boolean;
  lastHeartbeat?: Date;
  reconnectAttempts: number;
  fallbackActive: boolean;
}

export const useWebSocketRealtime = (config: WebSocketRealtimeConfig) => {
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    reconnectAttempts: 0,
    fallbackActive: false
  });
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();

  const updateStatus = useCallback((updates: Partial<WebSocketStatus>) => {
    setStatus(prev => ({ ...prev, ...updates }));
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    heartbeatTimeoutRef.current = setTimeout(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('ping.server', 'ping');
        updateStatus({ lastHeartbeat: new Date() });
        startHeartbeat(); // Continue heartbeat
      }
    }, 30000); // 30 segundos
  }, [updateStatus]);

  const connect = useCallback(async () => {
    if (!config.enabled || !config.instanceId) {
      console.log('🚫 [WEBSOCKET] WebSocket desabilitado ou instância não definida');
      return;
    }

    try {
      console.log('🔌 [WEBSOCKET] Conectando...', {
        instanceId: config.instanceId,
        clientId: config.clientId
      });

      // Usar domínio da API Yumer
      const socket = io('wss://api.yumer.com.br', {
        transports: ['websocket'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        auth: {
          instanceId: config.instanceId,
          clientId: config.clientId
        }
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ [WEBSOCKET] Conectado com sucesso');
        updateStatus({
          connected: true,
          reconnectAttempts: 0,
          fallbackActive: false
        });
        startHeartbeat();
      });

      socket.on('disconnect', (reason) => {
        console.warn('🚫 [WEBSOCKET] Desconectado:', reason);
        updateStatus({
          connected: false,
          fallbackActive: true
        });
        
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ [WEBSOCKET] Erro de conexão:', error);
        setStatus(prev => ({
          ...prev,
          connected: false,
          reconnectAttempts: prev.reconnectAttempts + 1,
          fallbackActive: true
        }));
      });

      // Event handlers específicos
      socket.on('messages.upsert', (data) => {
        console.log('📨 [WEBSOCKET] Nova mensagem recebida:', data);
        config.onMessage?.(data);
      });

      socket.on('qrcode.update', (data) => {
        console.log('🔲 [WEBSOCKET] QR Code atualizado:', data);
        config.onQRUpdate?.(data);
      });

      socket.on('connection.update', (data) => {
        console.log('🔄 [WEBSOCKET] Status de conexão atualizado:', data);
        config.onConnectionUpdate?.(data);
      });

      socket.on('presence.update', (data) => {
        console.log('👤 [WEBSOCKET] Presença atualizada:', data);
        config.onPresenceUpdate?.(data);
      });

      socket.on('pong.server', (data) => {
        console.log('🏓 [WEBSOCKET] Pong recebido:', data);
        updateStatus({ lastHeartbeat: new Date() });
      });

    } catch (error) {
      console.error('❌ [WEBSOCKET] Erro ao conectar:', error);
      updateStatus({
        connected: false,
        fallbackActive: true
      });
    }
  }, [config, updateStatus, startHeartbeat]);

  const disconnect = useCallback(() => {
    console.log('🔌 [WEBSOCKET] Desconectando...');
    
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    updateStatus({
      connected: false,
      reconnectAttempts: 0,
      fallbackActive: false
    });
  }, [updateStatus]);

  // Conectar/desconectar baseado na configuração
  useEffect(() => {
    if (config.enabled && config.instanceId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [config.enabled, config.instanceId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    connect,
    disconnect,
    isConnected: status.connected,
    isFallbackActive: status.fallbackActive,
    reconnectAttempts: status.reconnectAttempts
  };
};