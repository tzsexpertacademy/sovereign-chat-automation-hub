/**
 * HOOK ÚNICO E DEFINITIVO PARA MENSAGENS DE TICKETS
 * Substitui todos os outros hooks para eliminar duplicação
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

// Cache local por ticket (elimina conflitos globais)
const messagesCache = new Map<string, TicketMessagesCache>();
const CACHE_TTL = 20000; // 20 segundos (reduzido)

export const useTicketMessagesUnified = ({ ticketId, clientId }: TicketMessagesUnifiedConfig) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateSource, setLastUpdateSource] = useState<'cache' | 'supabase' | 'polling'>('polling');
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');
  const lastLoadRef = useRef<number>(0);
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

  // Função otimizada para adicionar mensagem sem duplicatas - O(1) lookup
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'cache' | 'supabase' | 'polling') => {
    setMessages(prev => {
      // Verificação O(1) com Set
      if (messageIdsRef.current.has(newMessage.message_id)) {
        return prev; // Duplicata ignorada silenciosamente
      }

      // Verificação adicional por conteúdo (apenas para casos raros)
      const exists = prev.some(msg => 
        msg.content === newMessage.content && 
        Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 2000
      );
      
      if (exists) {
        return prev;
      }

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
          console.log('⚡ [UNIFIED] Carregando do cache:', cached.length, 'mensagens');
          setMessages(cached);
          messageIdsRef.current.clear();
          cached.forEach(msg => messageIdsRef.current.add(msg.message_id));
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
        messagesData.forEach(msg => messageIdsRef.current.add(msg.message_id));
        setMessages(messagesData);
        setCachedMessages(ticketId, messagesData);
      } else {
        // Para polling, apenas adicionar novas mensagens
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

  // Listener Supabase OTIMIZADO com debounce reduzido
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    let debounceTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnects = 5;
    
    const createChannel = () => {
      const channel = supabase
        .channel(`unified-${ticketId}-${Date.now()}`, {
          config: {
            presence: { key: 'ticket_messages' },
            broadcast: { self: true }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ticket_messages',
            filter: `ticket_id=eq.${ticketId}`
          },
          (payload) => {
            // Debounce reduzido para 200ms (5x mais rápido)
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
              if (payload.eventType === 'INSERT' && payload.new) {
                const newMessage = payload.new as TicketMessage;
                
                if (!messageIdsRef.current.has(newMessage.message_id)) {
                  addMessageSafely(newMessage, 'supabase');
                }
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                const updatedMessage = payload.new as TicketMessage;
                setMessages(prev => 
                  prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
                );
                setLastUpdateSource('supabase');
              }
              
              lastLoadRef.current = Date.now();
              reconnectAttempts = 0; // Reset on successful message
            }, 200); // Reduzido de 1000ms para 200ms
          }
        )
        .subscribe((status) => {
          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            if (reconnectAttempts < maxReconnects) {
              reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 8000);
              setTimeout(() => {
                if (currentTicketRef.current === ticketId) {
                  supabase.removeChannel(channel);
                  channelRef.current = createChannel();
                }
              }, delay);
            }
          }
        });
      
      return channel;
    };

    return createChannel();
  }, [ticketId, addMessageSafely]);

  // Polling backup otimizado - 120 segundos (reduzida sobrecarga)
  const startPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      const timeSinceLastLoad = Date.now() - lastLoadRef.current;
      
      // Smart polling: apenas se realtime falhou por mais de 30s
      if (timeSinceLastLoad > 30000 && currentTicketRef.current === ticketId) {
        loadMessages(true, false); // Polling sem cache
      }
      
      startPolling();
    }, 120000); // Reduzido para 120 segundos (menos sobrecarga)
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

    console.log('🚀 [UNIFIED] Inicializando para ticket:', ticketId);
    setMessages([]);
    setIsLoading(true);
    currentTicketRef.current = ticketId;
    messageIdsRef.current.clear();

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
    reload: () => loadMessages(false, false), // Forçar reload sem cache
    isRealtimeActive: !!channelRef.current,
    isPollingActive: !!pollTimeoutRef.current
  };
};