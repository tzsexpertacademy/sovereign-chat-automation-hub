/**
 * HOOK DEFINITIVO PARA MENSAGENS DE TICKETS
 * Sistema ULTRA-OTIMIZADO com optimistic UI e zero duplicatas
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

interface TicketMessagesCache {
  messages: TicketMessage[];
  timestamp: number;
  ticketId: string;
}

interface TicketMessagesUnifiedConfig {
  ticketId: string;
  clientId: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastUpdate: number;
  reconnectAttempts: number;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
}

// Cache local otimizado
const messagesCache = new Map<string, TicketMessagesCache>();
const CACHE_TTL = 10000; // 10 segundos - otimizado para fluidez

export const useTicketMessagesUnified = ({ ticketId, clientId }: TicketMessagesUnifiedConfig) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateSource, setLastUpdateSource] = useState<'cache' | 'supabase' | 'polling'>('polling');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastUpdate: 0,
    reconnectAttempts: 0,
    status: 'disconnected'
  });
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');
  const messageIdsRef = useRef<Set<string>>(new Set());

  // Cache inteligente
  const getCachedMessages = useCallback((ticketId: string): TicketMessage[] | null => {
    const cached = messagesCache.get(ticketId);
    if (!cached) return null;
    
    const isExpired = (Date.now() - cached.timestamp) > CACHE_TTL;
    if (isExpired) {
      messagesCache.delete(ticketId);
      return null;
    }
    
    return cached.messages;
  }, []);

  const setCachedMessages = useCallback((ticketId: string, messages: TicketMessage[]) => {
    messagesCache.set(ticketId, {
      messages,
      timestamp: Date.now(),
      ticketId
    });
  }, []);

  // 🎯 DEDUPLICAÇÃO ULTRA-OTIMIZADA - O(1) performance
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'cache' | 'supabase' | 'polling') => {
    setMessages(prevMessages => {
      // Set de IDs para verificação O(1) - SUPER RÁPIDO
      if (messageIdsRef.current.has(newMessage.message_id)) {
        return prevMessages;
      }

      // Verificação adicional por ID único do banco
      const hasDbId = prevMessages.some(m => m.id === newMessage.id);
      if (hasDbId) {
        return prevMessages;
      }

      // ✅ ADICIONAR mensagem aprovada + atualizar cache de IDs
      messageIdsRef.current.add(newMessage.message_id);
      
      return [...prevMessages, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
  }, []);

  // 🚀 CARREGAMENTO OTIMIZADO - cache inteligente sem overhead
  const loadMessages = useCallback(async (isPolling = false, useCache = true) => {
    try {
      // Cache hit - retorno instantâneo apenas no carregamento inicial
      if (useCache && !isPolling) {
        const cached = getCachedMessages(ticketId);
        if (cached) {
          setMessages(cached.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
          cached.forEach(msg => messageIdsRef.current.add(msg.message_id));
          setLastUpdateSource('cache');
          return;
        }
      }

      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true });

      if (error) {
        setConnectionStatus(prev => ({ ...prev, isConnected: false }));
        return;
      }

      if (data) {
        if (!isPolling) {
          // Carregamento inicial completo
          setCachedMessages(ticketId, data);
          setMessages(data);
          messageIdsRef.current.clear();
          data.forEach(msg => messageIdsRef.current.add(msg.message_id));
          setLastUpdateSource('supabase');
        } else {
          // Polling: adicionar apenas novas
          data.forEach(msg => addMessageSafely(msg, 'polling'));
          setLastUpdateSource('polling');
        }
      }

      setConnectionStatus(prev => ({ ...prev, isConnected: true, lastUpdate: Date.now() }));

    } catch (error) {
      console.error('❌ [TICKET-MSG] Erro:', error);
      setConnectionStatus(prev => ({ ...prev, isConnected: false }));
    }
  }, [ticketId, addMessageSafely, getCachedMessages, setCachedMessages]);

  // 🔗 LISTENER SUPABASE ULTRA ESTÁVEL
  const setupSupabaseListener = useCallback(() => {
    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public', 
        table: 'ticket_messages',
        filter: `ticket_id=eq.${ticketId}`
      }, (payload) => {
        if (payload.new) {
          addMessageSafely(payload.new as TicketMessage, 'supabase');
          setLastUpdateSource('supabase');
          setConnectionStatus(prev => ({ ...prev, isConnected: true, lastUpdate: Date.now() }));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ticket_messages', 
        filter: `ticket_id=eq.${ticketId}`
      }, (payload) => {
        if (payload.new) {
          setMessages(prevMessages => 
            prevMessages.map(msg => msg.id === payload.new.id ? payload.new as TicketMessage : msg)
          );
          setLastUpdateSource('supabase');
        }
      })
      .subscribe((status) => {
        setConnectionStatus(prev => ({ ...prev, isConnected: status === 'SUBSCRIBED', lastUpdate: Date.now() }));
      });

    return () => supabase.removeChannel(channel);
  }, [ticketId, addMessageSafely]);

  // 🔄 POLLING OTIMIZADO - apenas quando necessário  
  const startPolling = useCallback(() => {
    const interval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - connectionStatus.lastUpdate;
      if (timeSinceLastUpdate > 30000) {
        loadMessages(true, false);
      }
    }, 20000); // Verificar a cada 20 segundos

    return interval;
  }, [loadMessages, connectionStatus.lastUpdate]);

  // Effect principal SIMPLIFICADO
  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    // Reset completo apenas ao trocar de ticket
    if (currentTicketRef.current !== ticketId) {
      currentTicketRef.current = ticketId;
      setMessages([]);
      messageIdsRef.current.clear();
      setIsLoading(true);
      
      // Cleanup anterior
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // Inicializar sistema
      loadMessages(false, true).finally(() => setIsLoading(false));
      channelRef.current = setupSupabaseListener();
      const pollingInterval = startPolling();
      pollTimeoutRef.current = pollingInterval as NodeJS.Timeout;
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ticketId, loadMessages, setupSupabaseListener, startPolling]);

  return {
    messages,
    isLoading,
    lastUpdateSource,
    reload: () => loadMessages(false, false),
    isRealtimeActive: connectionStatus.isConnected,
    isPollingActive: !!pollTimeoutRef.current,
    connectionStatus
  };
};