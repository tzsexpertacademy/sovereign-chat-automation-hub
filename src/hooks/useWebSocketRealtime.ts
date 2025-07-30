import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/hooks/use-toast';
import { businessTokenService } from '@/services/businessTokenService';
import { webSocketConfigService } from '@/services/webSocketConfigService';

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
  configured: boolean;
  maxReconnectAttempts: number;
}

export const useWebSocketRealtime = (config: WebSocketRealtimeConfig) => {
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    reconnectAttempts: 0,
    fallbackActive: false,
    configured: false,
    maxReconnectAttempts: 3
  });
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false);

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
    if (!config.enabled || !config.instanceId || isConnectingRef.current) {
      console.log('🚫 [WEBSOCKET] WebSocket desabilitado, instância não definida ou já conectando');
      return;
    }

    // Prevenir múltiplas tentativas simultâneas
    if (status.reconnectAttempts >= status.maxReconnectAttempts) {
      console.warn('⚠️ [WEBSOCKET] Máximo de tentativas atingido, ativando fallback permanente');
      updateStatus({ fallbackActive: true });
      return;
    }

    isConnectingRef.current = true;

    try {
      console.log('🔌 [WEBSOCKET] Conectando...', {
        instanceId: config.instanceId,
        clientId: config.clientId,
        attempt: status.reconnectAttempts + 1
      });

      // 1. Garantir que WebSocket está configurado na API
      const configured = await webSocketConfigService.ensureWebSocketConfigured(config.instanceId);
      if (!configured) {
        console.error('❌ [WEBSOCKET] Falha ao configurar WebSocket na API');
        updateStatus({ fallbackActive: true });
        return;
      }

      // 2. Obter token JWT válido
      const token = await businessTokenService.getValidBusinessToken(config.clientId);
      if (!token) {
        console.error('❌ [WEBSOCKET] Falha ao obter token JWT válido');
        updateStatus({ fallbackActive: true });
        return;
      }

      // 3. Criar conexão WebSocket com autenticação
      const socket = io('wss://api.yumer.com.br', {
        transports: ['websocket'],
        timeout: 15000,
        reconnection: false, // Controlaremos manualmente
        auth: {
          token: `Bearer ${token}`,
          instanceId: config.instanceId,
          clientId: config.clientId
        }
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ [WEBSOCKET] Conectado com sucesso');
        isConnectingRef.current = false;
        updateStatus({
          connected: true,
          reconnectAttempts: 0,
          fallbackActive: false,
          configured: true
        });
        startHeartbeat();
      });

      socket.on('disconnect', (reason) => {
        console.warn('🚫 [WEBSOCKET] Desconectado:', reason);
        isConnectingRef.current = false;
        updateStatus({
          connected: false,
          fallbackActive: true
        });
        
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }

        // Tentar reconectar apenas se não foi desconexão manual
        if (reason !== 'io client disconnect' && status.reconnectAttempts < status.maxReconnectAttempts) {
          scheduleReconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('❌ [WEBSOCKET] Erro de conexão:', error);
        isConnectingRef.current = false;
        setStatus(prev => ({
          ...prev,
          connected: false,
          reconnectAttempts: prev.reconnectAttempts + 1,
          fallbackActive: true
        }));

        // Tentar reconectar com delay exponencial
        if (status.reconnectAttempts < status.maxReconnectAttempts) {
          scheduleReconnect();
        }
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
      isConnectingRef.current = false;
      updateStatus({
        connected: false,
        fallbackActive: true
      });
    }
  }, [config.enabled, config.instanceId, config.clientId, updateStatus, startHeartbeat, status.reconnectAttempts, status.maxReconnectAttempts]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, status.reconnectAttempts), 30000); // Max 30s
    console.log(`⏰ [WEBSOCKET] Reagendando reconexão em ${delay}ms...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, status.reconnectAttempts]);

  const disconnect = useCallback(() => {
    console.log('🔌 [WEBSOCKET] Desconectando...');
    
    isConnectingRef.current = false;
    
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    updateStatus({
      connected: false,
      reconnectAttempts: 0,
      fallbackActive: false,
      configured: false
    });
  }, [updateStatus]);

  // Memoizar configuração para evitar reconnexões desnecessárias  
  const stableConfig = useMemo(() => ({
    enabled: config.enabled,
    instanceId: config.instanceId,
    clientId: config.clientId
  }), [config.enabled, config.instanceId, config.clientId]);

  // Conectar/desconectar baseado na configuração com debounce
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (stableConfig.enabled && stableConfig.instanceId) {
        connect();
      } else {
        disconnect();
      }
    }, 500); // Debounce de 500ms

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [stableConfig.enabled, stableConfig.instanceId, connect, disconnect]);

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
    reconnectAttempts: status.reconnectAttempts,
    isConfigured: status.configured
  };
};