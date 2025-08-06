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

  // Função ULTRA-OTIMIZADA para adicionar mensagem sem duplicatas
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'cache' | 'supabase' | 'polling') => {
    setMessages(prev => {
      // VERIFICAÇÃO RIGOROSA DE DUPLICATAS
      const messageKey = `${newMessage.message_id}_${newMessage.content.substring(0, 50)}`;
      const messageTimestamp = new Date(newMessage.timestamp).getTime();
      
      // 1. Verificação O(1) com Set
      if (messageIdsRef.current.has(newMessage.message_id)) {
        return prev; // Duplicata ignorada
      }

      // 2. Verificação por conteúdo e timestamp (mais rigorosa)
      const existingTimestamp = duplicateCheckRef.current.get(messageKey);
      if (existingTimestamp && Math.abs(messageTimestamp - existingTimestamp) < 5000) {
        return prev; // Duplicata por conteúdo
      }

      // 3. Verificação final por database ID (para casos raros)
      const exists = prev.some(msg => 
        (msg.id === newMessage.id) || 
        (msg.content === newMessage.content && 
         Math.abs(new Date(msg.timestamp).getTime() - messageTimestamp) < 3000)
      );
      
      if (exists) {
        return prev;
      }

      // Registrar mensagem nos caches
      messageIdsRef.current.add(newMessage.message_id);
      duplicateCheckRef.current.set(messageKey, messageTimestamp);
      setLastUpdateSource(source);
      
      const updated = [...prev, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Atualizar cache local
      setCachedMessages(ticketId, updated);
      
      // Log apenas para novos casos críticos
      if (source === 'supabase') {
        console.log('📨 [UNIFIED] Nova mensagem real-time:', newMessage.message_id);
      }
      
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

  // Listener Supabase ULTRA-OTIMIZADO - sem debounce para mensagens instantâneas
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    let reconnectAttempts = 0;
    const maxReconnects = 3;
    
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
            // SEM DEBOUNCE - mensagens aparecem instantaneamente
            if (payload.eventType === 'INSERT' && payload.new) {
              const newMessage = payload.new as TicketMessage;
              
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
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedMessage = payload.new as TicketMessage;
              setMessages(prev => 
                prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
              );
              setLastUpdateSource('supabase');
            }
            
            lastLoadRef.current = Date.now();
            reconnectAttempts = 0;
          }
        )
        .subscribe((status) => {
          console.log(`🔗 [UNIFIED] Canal status: ${status} para ticket: ${ticketId}`);
          
          if (status === 'SUBSCRIBED') {
            setConnectionStatus(prev => ({
              ...prev,
              isConnected: true,
              status: 'connected',
              reconnectAttempts: 0
            }));
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            setConnectionStatus(prev => ({
              ...prev,
              isConnected: false,
              status: 'error',
              reconnectAttempts: prev.reconnectAttempts + 1
            }));
            
            if (reconnectAttempts < maxReconnects) {
              reconnectAttempts++;
              const delay = Math.min(2000 * reconnectAttempts, 8000);
              setTimeout(() => {
                if (currentTicketRef.current === ticketId) {
                  console.log(`🔄 [UNIFIED] Reconectando canal... tentativa ${reconnectAttempts}`);
                  supabase.removeChannel(channel);
                  channelRef.current = createChannel();
                }
              }, delay);
            }
          } else {
            setConnectionStatus(prev => ({
              ...prev,
              status: 'connecting'
            }));
          }
        });
      
      return channel;
    };

    return createChannel();
  }, [ticketId, addMessageSafely]);

  // Polling backup INTELIGENTE - apenas quando necessário
  const startPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      const timeSinceLastLoad = Date.now() - lastLoadRef.current;
      
      // Smart polling: apenas se realtime falhou por mais de 45s
      if (timeSinceLastLoad > 45000 && currentTicketRef.current === ticketId) {
        console.log('🔄 [UNIFIED] Polling de backup ativado (realtime inativo)');
        loadMessages(true, false);
      }
      
      startPolling();
    }, 180000); // Reduzido sobrecarga: 3 minutos
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