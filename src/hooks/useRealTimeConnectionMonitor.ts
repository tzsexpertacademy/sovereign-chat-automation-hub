/**
 * Monitor de conexões realtime com heartbeat inteligente
 * Monitora saúde das conexões Supabase e reconecta automaticamente
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionStatus {
  isConnected: boolean;
  lastHeartbeat: number;
  reconnectAttempts: number;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export const useRealTimeConnectionMonitor = (channelName: string) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastHeartbeat: 0,
    reconnectAttempts: 0,
    status: 'disconnected'
  });

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const pingChannelRef = useRef<any>(null);

  // Heartbeat customizado para manter conexão ativa
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      if (pingChannelRef.current) {
        // Enviar ping via broadcast
        pingChannelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now() }
        });

        setConnectionStatus(prev => ({
          ...prev,
          lastHeartbeat: Date.now()
        }));
      }
    }, 15000); // Heartbeat a cada 15s
  }, []);

  // Configurar canal de monitoramento
  useEffect(() => {
    if (!channelName) return;

    const setupPingChannel = () => {
      if (pingChannelRef.current) {
        supabase.removeChannel(pingChannelRef.current);
      }

      pingChannelRef.current = supabase
        .channel(`ping-${channelName}`, {
          config: {
            presence: { key: 'heartbeat' },
            broadcast: { self: true }
          }
        })
        .on('broadcast', { event: 'heartbeat' }, () => {
          // Heartbeat recebido
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: true,
            status: 'connected',
            reconnectAttempts: 0
          }));
        })
        .subscribe((status) => {
          setConnectionStatus(prev => ({
            ...prev,
            status: status === 'SUBSCRIBED' ? 'connected' : 
                   status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'error' : 
                   'connecting'
          }));

          if (status === 'SUBSCRIBED') {
            startHeartbeat();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus(prev => ({
              ...prev,
              isConnected: false,
              reconnectAttempts: prev.reconnectAttempts + 1
            }));

            // Reconexão automática com backoff
            if (connectionStatus.reconnectAttempts < 5) {
              const delay = Math.min(1000 * Math.pow(2, connectionStatus.reconnectAttempts), 30000);
              setTimeout(setupPingChannel, delay);
            }
          }
        });
    };

    setupPingChannel();

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (pingChannelRef.current) {
        supabase.removeChannel(pingChannelRef.current);
      }
    };
  }, [channelName, startHeartbeat, connectionStatus.reconnectAttempts]);

  return {
    connectionStatus,
    forceReconnect: () => {
      setConnectionStatus(prev => ({
        ...prev,
        reconnectAttempts: 0
      }));
    }
  };
};