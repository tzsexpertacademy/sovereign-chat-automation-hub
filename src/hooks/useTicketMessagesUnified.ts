/**
 * HOOK ÚNICO E DEFINITIVO PARA MENSAGENS DE TICKETS
 * Sistema ULTRA-OTIMIZADO sem duplicatas e real-time perfeito
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

// Cache local por ticket (elimina conflitos globais)
const messagesCache = new Map<string, TicketMessagesCache>();
const CACHE_TTL = 15000; // 15 segundos (otimizado)

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
  const lastLoadRef = useRef<number>(0);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const duplicateCheckRef = useRef<Map<string, number>>(new Map()); // Cache para verificação de duplicatas

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

  // Função ULTRA-RIGOROSA anti-duplicação
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'cache' | 'supabase' | 'polling') => {
    setMessages(prev => {
      // 1. VERIFICAÇÃO PRIMÁRIA por message_id (O(1))
      if (messageIdsRef.current.has(newMessage.message_id)) {
        return prev;
      }

      // 2. VERIFICAÇÃO SECUNDÁRIA por ID do banco (para casos edge)
      if (prev.some(msg => msg.id === newMessage.id)) {
        return prev;
      }

      // 3. VERIFICAÇÃO TERCIÁRIA por conteúdo + timestamp (anti-duplicação total)
      const messageTimestamp = new Date(newMessage.timestamp).getTime();
      const contentMatch = prev.find(msg => 
        msg.content === newMessage.content && 
        Math.abs(new Date(msg.timestamp).getTime() - messageTimestamp) < 2000
      );
      
      if (contentMatch) {
        return prev;
      }

      // Registrar mensagem nos caches
      messageIdsRef.current.add(newMessage.message_id);
      setLastUpdateSource(source);
      
      const updated = [...prev, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Atualizar cache local
      setCachedMessages(ticketId, updated);
      
      return updated;
    });
  }, [ticketId, setCachedMessages]);

  // Carregamento principal com cache
  const loadMessages = useCallback(async (isPolling = false, useCache = true) => {
    try {
      if (!isPolling) setIsLoading(true);
      
      // Verificar cache primeiro
      if (useCache && !isPolling) {
        const cached = getCachedMessages(ticketId);
        if (cached) {
          setMessages(cached);
          messageIdsRef.current.clear();
          duplicateCheckRef.current.clear();
          cached.forEach(msg => {
            messageIdsRef.current.add(msg.message_id);
            const messageKey = `${msg.message_id}_${msg.content.substring(0, 50)}`;
            duplicateCheckRef.current.set(messageKey, new Date(msg.timestamp).getTime());
          });
          setLastUpdateSource('cache');
          setIsLoading(false);
          return;
        }
      }
      
      console.log(`🔄 [UNIFIED] ${isPolling ? 'Polling' : 'Carregando'} mensagens do banco:`, ticketId);
      
      const messagesData = await ticketsService.getTicketMessages(ticketId, 1000);
      
      // Reset apenas se for carregamento inicial
      if (!isPolling) {
        messageIdsRef.current.clear();
        duplicateCheckRef.current.clear();
        messagesData.forEach(msg => {
          messageIdsRef.current.add(msg.message_id);
          const messageKey = `${msg.message_id}_${msg.content.substring(0, 50)}`;
          duplicateCheckRef.current.set(messageKey, new Date(msg.timestamp).getTime());
        });
        setMessages(messagesData);
        setCachedMessages(ticketId, messagesData);
      } else {
        // Para polling, apenas adicionar novas mensagens (verificação rigorosa)
        messagesData.forEach(msg => {
          if (!messageIdsRef.current.has(msg.message_id)) {
            addMessageSafely(msg, 'polling');
          }
        });
      }
      
      lastLoadRef.current = Date.now();
      setLastUpdateSource('polling');
      
      console.log(`📨 [UNIFIED] ${messagesData.length} mensagens carregadas`);
    } catch (error) {
      console.error('❌ [UNIFIED] Erro ao carregar mensagens:', error);
      if (!isPolling) setMessages([]);
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  }, [ticketId, getCachedMessages, setCachedMessages, addMessageSafely]);

  // Listener Supabase ULTRA-ESTÁVEL - conexão única e confiável
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    const channel = supabase
      .channel(`ticket-messages-${ticketId}`, {
        config: {
          presence: { key: 'ticket_messages' }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          if (payload.new) {
            const newMessage = payload.new as TicketMessage;
            
            // VERIFICAÇÃO RIGOROSA DE DUPLICATAS - instantânea
            if (!messageIdsRef.current.has(newMessage.message_id)) {
              addMessageSafely(newMessage, 'supabase');
              setConnectionStatus(prev => ({
                ...prev,
                isConnected: true,
                lastUpdate: Date.now(),
                status: 'connected',
                reconnectAttempts: 0
              }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          if (payload.new) {
            const updatedMessage = payload.new as TicketMessage;
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
            setLastUpdateSource('supabase');
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus({
            isConnected: true,
            lastUpdate: Date.now(),
            status: 'connected',
            reconnectAttempts: 0
          });
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: false,
            status: 'error'
          }));
        }
      });
      
    return channel;
  }, [ticketId, addMessageSafely]);

  // Polling backup SIMPLIFICADO - apenas emergencial
  const startPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      const timeSinceLastLoad = Date.now() - lastLoadRef.current;
      
      // Polling emergencial: apenas se realtime falhou por mais de 120s
      if (timeSinceLastLoad > 120000 && currentTicketRef.current === ticketId) {
        loadMessages(true, false);
      }
      
      startPolling();
    }, 300000); // 5 minutos - reduzido drasticamente
  }, [ticketId, loadMessages]);

  // Effect principal
  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    // Evitar reinicialização desnecessária
    if (currentTicketRef.current === ticketId) {
      return;
    }

    console.log('🚀 [UNIFIED] Inicializando sistema ultra-otimizado para ticket:', ticketId);
    setMessages([]);
    setIsLoading(true);
    currentTicketRef.current = ticketId;
    messageIdsRef.current.clear();
    duplicateCheckRef.current.clear();
    setConnectionStatus({
      isConnected: false,
      lastUpdate: 0,
      reconnectAttempts: 0,
      status: 'connecting'
    });

    // Cleanup anterior
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Inicializar recursos
    loadMessages(false, true); // Carregar com cache
    channelRef.current = setupSupabaseListener();
    startPolling();

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