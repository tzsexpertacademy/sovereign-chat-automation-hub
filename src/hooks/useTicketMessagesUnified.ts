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

// Cache global com TTL de 30 segundos
const messagesCache = new Map<string, TicketMessagesCache>();
const CACHE_TTL = 30000; // 30 segundos

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

  // Função única para adicionar mensagem sem duplicatas
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'cache' | 'supabase' | 'polling') => {
    setMessages(prev => {
      // Verificação rigorosa de duplicatas
      const exists = prev.some(msg => 
        msg.message_id === newMessage.message_id ||
        (msg.content === newMessage.content && 
         Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 1000)
      );
      
      if (exists) {
        console.log('⚠️ [UNIFIED] Mensagem duplicada ignorada:', newMessage.message_id);
        return prev;
      }

      messageIdsRef.current.add(newMessage.message_id);
      setLastUpdateSource(source);
      
      const updated = [...prev, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Atualizar cache
      setCachedMessages(ticketId, updated);
      
      console.log(`📨 [UNIFIED] Nova mensagem via ${source}:`, {
        messageId: newMessage.message_id,
        content: newMessage.content?.substring(0, 50),
        totalMessages: updated.length
      });
      
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

  // Listener Supabase ÚNICO com debounce
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    console.log('🔔 [UNIFIED] Configurando listener único para ticket:', ticketId);
    
    let debounceTimeout: NodeJS.Timeout;
    
    const channel = supabase
      .channel(`unified-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          // Debounce de 1000ms para múltiplas mudanças rápidas
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            console.log('📨 [UNIFIED] Mudança Supabase:', payload.eventType);
            
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
          }, 1000);
        }
      )
      .subscribe((status) => {
        console.log('📡 [UNIFIED] Status:', status);
      });

    return channel;
  }, [ticketId, addMessageSafely]);

  // Polling inteligente - reduzido para 60 segundos
  const startPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      const timeSinceLastLoad = Date.now() - lastLoadRef.current;
      
      // Polling apenas se não houve atividade recente
      if (timeSinceLastLoad > 60000 && currentTicketRef.current === ticketId) {
        console.log('🔄 [UNIFIED] Polling backup executado');
        loadMessages(true, false); // Polling sem cache
      }
      
      startPolling();
    }, 60000); // 60 segundos
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