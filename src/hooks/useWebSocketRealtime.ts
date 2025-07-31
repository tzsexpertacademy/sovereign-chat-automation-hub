import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { socketIOWebSocketService } from '@/services/socketIOWebSocketService';

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
  circuitBreakerBlocked: boolean;
  circuitBreakerUnblockTime: number;
}

export const useWebSocketRealtime = (config: WebSocketRealtimeConfig) => {
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    reconnectAttempts: 0,
    fallbackActive: false,
    configured: false,
    maxReconnectAttempts: 3,
    circuitBreakerBlocked: false,
    circuitBreakerUnblockTime: 0
  });
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false);

  const updateStatus = useCallback((updates: Partial<WebSocketStatus>) => {
    setStatus(prev => ({ ...prev, ...updates }));
  }, []);

  const connect = useCallback(async () => {
    if (!config.enabled || !config.instanceId || isConnectingRef.current) {
      console.log('🚫 [WEBSOCKET] WebSocket desabilitado, instância não definida ou já conectando');
      return;
    }

    // Verificar status do circuit breaker
    const circuitStatus = socketIOWebSocketService.getCircuitBreakerStatus();
    if (circuitStatus.blocked) {
      console.warn('🚫 [WEBSOCKET] Circuit breaker ativo - usando Supabase por', new Date(circuitStatus.unblockTime).toLocaleTimeString());
      updateStatus({ 
        fallbackActive: true,
        circuitBreakerBlocked: true,
        circuitBreakerUnblockTime: circuitStatus.unblockTime
      });
      return;
    }

    if (status.reconnectAttempts >= status.maxReconnectAttempts) {
      console.warn('⚠️ [WEBSOCKET] Máximo de tentativas atingido, ativando fallback permanente');
      updateStatus({ fallbackActive: true });
      return;
    }

    isConnectingRef.current = true;

    try {
      console.log('🔌 [WEBSOCKET] Conectando via Socket.IO...', {
        instanceId: config.instanceId,
        clientId: config.clientId,
        attempt: status.reconnectAttempts + 1
      });

      // Usar o novo serviço Socket.IO
      const connected = await socketIOWebSocketService.connect({
        instanceId: config.instanceId,
        clientId: config.clientId,
        onMessage: config.onMessage,
        onQRUpdate: config.onQRUpdate,
        onConnectionUpdate: config.onConnectionUpdate,
        onPresenceUpdate: config.onPresenceUpdate
      });

      isConnectingRef.current = false;

      if (connected) {
        updateStatus({
          connected: true,
          reconnectAttempts: 0,
          fallbackActive: false,
          configured: true,
          circuitBreakerBlocked: false,
          circuitBreakerUnblockTime: 0
        });
      } else {
        // Verificar se falhou por circuit breaker
        const circuitStatus = socketIOWebSocketService.getCircuitBreakerStatus();
        
        updateStatus({
          connected: false,
          reconnectAttempts: status.reconnectAttempts + 1,
          fallbackActive: true,
          circuitBreakerBlocked: circuitStatus.blocked,
          circuitBreakerUnblockTime: circuitStatus.unblockTime
        });

        // Só tentar reconectar se não for circuit breaker
        if (status.reconnectAttempts < status.maxReconnectAttempts && !circuitStatus.blocked) {
          scheduleReconnect();
        }
      }

    } catch (error) {
      console.error('❌ [WEBSOCKET] Erro ao conectar:', error);
      isConnectingRef.current = false;
      updateStatus({
        connected: false,
        fallbackActive: true
      });
    }
  }, [config.enabled, config.instanceId, config.clientId, updateStatus, status.reconnectAttempts, status.maxReconnectAttempts]);

  const scheduleReconnect = useCallback(() => {
    // Reconexão mais rápida - máximo 5 segundos
    const delay = Math.min(1000 * Math.pow(2, status.reconnectAttempts), 5000);
    console.log(`⏰ [WEBSOCKET] Reagendando reconexão em ${delay}ms...`);

    setTimeout(() => {
      connect();
    }, delay);
  }, [connect, status.reconnectAttempts]);

  const disconnect = useCallback(() => {
    console.log('🔌 [WEBSOCKET] Desconectando...');
    
    isConnectingRef.current = false;
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    socketIOWebSocketService.disconnect();
    
    updateStatus({
      connected: false,
      reconnectAttempts: 0,
      fallbackActive: false,
      configured: false,
      circuitBreakerBlocked: false,
      circuitBreakerUnblockTime: 0
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
    isConfigured: status.configured,
    isCircuitBreakerBlocked: status.circuitBreakerBlocked,
    circuitBreakerUnblockTime: status.circuitBreakerUnblockTime
  };
};