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
    // WebSocket COMPLETAMENTE DESABILITADO
    console.log('🚫 [WEBSOCKET] *** WEBSOCKET DESABILITADO - SISTEMA 100% SUPABASE ***');
    
    updateStatus({
      connected: false,
      reconnectAttempts: 0,
      fallbackActive: true, // Supabase sempre ativo
      configured: false,
      circuitBreakerBlocked: false,
      circuitBreakerUnblockTime: 0
    });
    
    return;
  }, [updateStatus]);

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