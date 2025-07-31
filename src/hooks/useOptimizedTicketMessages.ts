import { useState, useEffect, useRef, useCallback } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

interface OptimizedTicketMessagesConfig {
  ticketId: string;
  clientId: string;
}

export const useOptimizedTicketMessages = ({ ticketId, clientId }: OptimizedTicketMessagesConfig) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateSource, setLastUpdateSource] = useState<'supabase' | 'polling'>('polling');
  const [optimisticMessages, setOptimisticMessages] = useState<TicketMessage[]>([]);
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');
  const messageIdsRef = useRef<Set<string>>(new Set());

  // 🚀 MENSAGEM OTIMISTA ULTRA-ESTÁVEL
  const addOptimisticMessage = useCallback((message: Partial<TicketMessage>) => {
    const optimisticMsg: TicketMessage = {
      id: `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ticket_id: ticketId,
      message_id: message.message_id || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: message.content || '',
      message_type: message.message_type || 'text',
      from_me: true,
      timestamp: new Date().toISOString(),
      sender_name: 'Você',
      processing_status: 'sending',
      is_ai_response: false,
      is_internal_note: false,
      created_at: new Date().toISOString(),
      ...message
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    
    // 🔄 AUTO-TIMEOUT: Se não confirmado em 5 segundos, manter como "enviado"
    setTimeout(() => {
      setOptimisticMessages(prev => 
        prev.map(msg => 
          msg.message_id === optimisticMsg.message_id && msg.processing_status === 'sending'
            ? { ...msg, processing_status: 'sent', sender_name: 'Você' }
            : msg
        )
      );
    }, 5000);

    return optimisticMsg.message_id;
  }, [ticketId]);

  // ✅ CONFIRMAÇÃO INTELIGENTE - Remove apenas quando tem certeza
  const confirmOptimisticMessage = useCallback((messageId: string) => {
    setOptimisticMessages(prev => {
      const filtered = prev.filter(msg => {
        // Remove apenas se for exatamente o mesmo messageId
        return msg.message_id !== messageId;
      });
      return filtered;
    });
  }, []);

  // ❌ FALHA COM RETRY VISUAL
  const failOptimisticMessage = useCallback((messageId: string) => {
    setOptimisticMessages(prev => 
      prev.map(msg => 
        msg.message_id === messageId 
          ? { 
              ...msg, 
              processing_status: 'failed', 
              sender_name: '❌ Erro - Clique para tentar novamente',
              content: `${msg.content} (falha no envio)` 
            }
          : msg
      )
    );
    
    // 🔄 Remover após 10 segundos se não for re-tentado
    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(msg => 
        !(msg.message_id === messageId && msg.processing_status === 'failed')
      ));
    }, 10000);
  }, []);

  // 🚀 ADIÇÃO INTELIGENTE SEM DUPLICATAS
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'supabase' | 'polling') => {
    setMessages(prev => {
      // ⚡ Verificação rápida de duplicatas
      const exists = prev.some(msg => 
        msg.message_id === newMessage.message_id ||
        (msg.content === newMessage.content && 
         Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 2000)
      );
      
      if (exists) {
        return prev;
      }

      messageIdsRef.current.add(newMessage.message_id);
      setLastUpdateSource(source);
      
      // 🧹 LIMPEZA INTELIGENTE de mensagem otimista
      setOptimisticMessages(prevOpt => 
        prevOpt.filter(optMsg => {
          // Remover se é a mesma mensagem ou muito similar
          const isSame = optMsg.message_id === newMessage.message_id ||
                        (optMsg.content === newMessage.content && 
                         Math.abs(new Date(optMsg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 5000);
          return !isSame;
        })
      );
      
      // ⚡ Inserção ordenada ultra-rápida
      const updated = [...prev, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      return updated;
    });
  }, []);

  // 📥 CARREGAMENTO OTIMIZADO
  const loadMessages = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setIsLoading(true);
      
      const messagesData = await ticketsService.getTicketMessages(ticketId, 1000);
      
      // Reset apenas se for carregamento inicial
      if (!isPolling) {
        messageIdsRef.current.clear();
        messagesData.forEach(msg => messageIdsRef.current.add(msg.message_id));
        setMessages(messagesData);
      } else {
        // Para polling, apenas adicionar novas mensagens
        messagesData.forEach(msg => {
          if (!messageIdsRef.current.has(msg.message_id)) {
            addMessageSafely(msg, 'polling');
          }
        });
      }
      
      setLastUpdateSource('polling');
      
    } catch (error) {
      console.error('❌ [OPTIMIZED-MESSAGES] Erro ao carregar mensagens:', error);
      if (!isPolling) setMessages([]);
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  }, [ticketId, addMessageSafely]);

  // 📡 SUPABASE REALTIME OTIMIZADO
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    const channel = supabase
      .channel(`optimized-${ticketId}`, {
        config: {
          presence: { key: 'ticket_messages' },
          broadcast: { self: false }
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
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Fallback imediato para polling
          loadMessages(true);
        }
      });

    return channel;
  }, [ticketId, addMessageSafely, loadMessages]);

  // 🔄 POLLING INTELIGENTE - 3 segundos para estabilidade
  const startIntelligentPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      if (currentTicketRef.current === ticketId) {
        loadMessages(true);
        startIntelligentPolling();
      }
    }, 3000); // 3 segundos para melhor estabilidade
  }, [ticketId, loadMessages]);

  // 🎛️ EFFECT PRINCIPAL OTIMIZADO
  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      setOptimisticMessages([]);
      return;
    }

    // Evitar re-inicialização desnecessária
    if (currentTicketRef.current === ticketId) {
      return;
    }

    setMessages([]);
    setOptimisticMessages([]);
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

    // Inicialização sequencial otimizada
    loadMessages();
    channelRef.current = setupSupabaseListener();
    startIntelligentPolling();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ticketId, loadMessages, setupSupabaseListener, startIntelligentPolling]);

  // 🔗 COMBINAR MENSAGENS OTIMIZADO
  const allMessages = [...messages, ...optimisticMessages].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    messages: allMessages,
    isLoading,
    lastUpdateSource,
    reload: () => loadMessages(false),
    isSupabaseActive: channelRef.current !== null,
    isPollingActive: pollTimeoutRef.current !== null,
    addOptimisticMessage,
    confirmOptimisticMessage,
    failOptimisticMessage
  };
};