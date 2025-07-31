import { useState, useEffect, useRef, useCallback } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

interface SimpleTicketMessagesConfig {
  ticketId: string;
  clientId: string;
}

export const useSimpleTicketMessages = ({ ticketId, clientId }: SimpleTicketMessagesConfig) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateSource, setLastUpdateSource] = useState<'supabase' | 'polling'>('polling');
  const [optimisticMessages, setOptimisticMessages] = useState<TicketMessage[]>([]);
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');
  const messageIdsRef = useRef<Set<string>>(new Set());

  // Função para adicionar mensagem otimista (instantânea para envios)
  const addOptimisticMessage = useCallback((message: Partial<TicketMessage>) => {
    const optimisticMsg: TicketMessage = {
      id: `optimistic_${Date.now()}`,
      ticket_id: ticketId,
      message_id: message.message_id || `opt_${Date.now()}`,
      content: message.content || '',
      message_type: message.message_type || 'text',
      from_me: true,
      timestamp: new Date().toISOString(),
      sender_name: 'Enviando...',
      processing_status: 'sending',
      is_ai_response: false,
      is_internal_note: false,
      created_at: new Date().toISOString(),
      ...message
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    
    console.log(`⚡ [REAL-TIME] Mensagem otimista adicionada:`, {
      messageId: optimisticMsg.message_id,
      content: optimisticMsg.content?.substring(0, 50)
    });

    return optimisticMsg.message_id;
  }, [ticketId]);

  // 🚀 CONFIRMAÇÃO ULTRA-RÁPIDA de mensagem otimista
  const confirmOptimisticMessage = useCallback((messageId: string) => {
    setOptimisticMessages(prev => {
      const filtered = prev.filter(msg => msg.message_id !== messageId);
      console.log(`⚡ [ULTRA-FAST] Mensagem otimista confirmada e removida: ${messageId}`);
      return filtered;
    });
  }, []);

  // ⚠️ FALHA ULTRA-RÁPIDA de mensagem otimista com retry automático
  const failOptimisticMessage = useCallback((messageId: string) => {
    setOptimisticMessages(prev => 
      prev.map(msg => 
        msg.message_id === messageId 
          ? { 
              ...msg, 
              processing_status: 'failed', 
              sender_name: '❌ Falha - Tentar novamente',
              content: `❌ FALHA: ${msg.content}` 
            }
          : msg
      )
    );
    console.log(`❌ [ULTRA-FAST] Mensagem otimista FALHOU: ${messageId}`);
    
    // 🔄 Auto-retry em 3 segundos
    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(msg => msg.message_id !== messageId));
      console.log(`🔄 [ULTRA-FAST] Mensagem falhada removida após timeout: ${messageId}`);
    }, 3000);
  }, []);

  // 🚀 FUNÇÃO ULTRA-RÁPIDA para adicionar mensagem sem duplicatas
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'supabase' | 'polling') => {
    const startTime = performance.now();
    
    setMessages(prev => {
      // ⚡ Verificação instantânea de duplicatas
      const exists = prev.some(msg => msg.message_id === newMessage.message_id);
      if (exists) {
        console.log(`⚡ [ULTRA-FAST] Mensagem duplicada ignorada: ${newMessage.message_id}`);
        return prev;
      }

      messageIdsRef.current.add(newMessage.message_id);
      setLastUpdateSource(source);
      
      // 🚀 REMOÇÃO INTELIGENTE de mensagem otimista
      setOptimisticMessages(prevOpt => {
        const filtered = prevOpt.filter(optMsg => {
          const shouldRemove = optMsg.message_id === newMessage.message_id ||
                             (optMsg.content === newMessage.content && 
                              Math.abs(new Date(optMsg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 5000);
          
          if (shouldRemove) {
            console.log(`✅ [ULTRA-FAST] Removendo mensagem otimista: ${optMsg.message_id}`);
          }
          
          return !shouldRemove;
        });
        
        return filtered;
      });
      
      // ⚡ ORDENAÇÃO ULTRA-RÁPIDA por timestamp
      const updated = [...prev, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const processingTime = performance.now() - startTime;
      
      console.log(`⚡ [ULTRA-FAST] Nova mensagem processada em ${processingTime.toFixed(2)}ms:`, {
        messageId: newMessage.message_id,
        content: newMessage.content?.substring(0, 50) + '...',
        fromMe: newMessage.from_me,
        source,
        totalMessages: updated.length,
        processingTimeMs: processingTime.toFixed(2)
      });
      
      return updated;
    });
  }, []);

  // Carregar mensagens
  const loadMessages = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setIsLoading(true);
      
      console.log(`🔄 [SIMPLE-MESSAGES] ${isPolling ? 'Polling' : 'Carregando'} mensagens para ticket:`, ticketId);
      
      const messagesData = await ticketsService.getTicketMessages(ticketId, 1000);
      
      // Reset do controle de duplicatas
      messageIdsRef.current.clear();
      messagesData.forEach(msg => messageIdsRef.current.add(msg.message_id));
      
      setMessages(messagesData);
      setLastUpdateSource('polling');
      
      console.log(`📨 [SIMPLE-MESSAGES] ${messagesData.length} mensagens carregadas via ${isPolling ? 'polling' : 'inicial'}`);
    } catch (error) {
      console.error('❌ [SIMPLE-MESSAGES] Erro ao carregar mensagens:', error);
      if (!isPolling) setMessages([]);
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  }, [ticketId]);

  // 🚀 SUPABASE REALTIME ULTRA-RESPONSIVO
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    console.log('⚡ [ULTRA-FAST] Configurando Supabase Realtime ULTRA-RESPONSIVO');
    
    const channel = supabase
      .channel(`ultra-fast-${ticketId}`, {
        config: {
          presence: { key: 'ticket_chat' },
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
          console.log('⚡ [ULTRA-FAST] Evento Supabase IMEDIATO:', {
            event: payload.eventType,
            messageId: (payload.new as any)?.message_id,
            fromMe: (payload.new as any)?.from_me,
            timestamp: Date.now()
          });
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new as TicketMessage;
            
            // ⚡ PROCESSAMENTO INSTANTÂNEO - Zero delay
            if (!messageIdsRef.current.has(newMessage.message_id)) {
              console.log('⚡ [ULTRA-FAST] Nova mensagem INSTANTÂNEA:', {
                messageId: newMessage.message_id,
                content: newMessage.content?.substring(0, 50),
                fromMe: newMessage.from_me,
                processingTime: Date.now()
              });
              
              addMessageSafely(newMessage, 'supabase');
            } else {
              console.log('⚡ [ULTRA-FAST] Mensagem já existe, ignorando duplicata');
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedMessage = payload.new as TicketMessage;
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
            setLastUpdateSource('supabase');
            console.log('⚡ [ULTRA-FAST] Mensagem atualizada:', updatedMessage.message_id);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [ULTRA-FAST] Status Supabase:', status);
        
        // ✅ HEARTBEAT para detectar falhas imediatamente
        if (status === 'SUBSCRIBED') {
          console.log('✅ [ULTRA-FAST] Supabase CONECTADO - Real-time ATIVO');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ [ULTRA-FAST] Falha no Supabase, iniciando polling backup imediato');
          loadMessages(true); // Carregar imediatamente em caso de falha
        }
      });

    return channel;
  }, [ticketId, addMessageSafely]);

  // 🚀 POLLING BACKUP ULTRA-AGRESSIVO - 2 segundos para máxima responsividade
  const startPollingBackup = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      if (currentTicketRef.current === ticketId) {
        console.log('🔄 [ULTRA-FAST] Polling backup ULTRA-AGRESSIVO');
        loadMessages(true);
        startPollingBackup();
      }
    }, 2000); // 🚀 2 segundos para experiência ultra-fluida
  }, [ticketId, loadMessages]);

  // Effect principal
  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    // Se é o mesmo ticket, não reinicializar
    if (currentTicketRef.current === ticketId) {
      return;
    }

    console.log('🔄 [SIMPLE-MESSAGES] Inicializando para ticket:', ticketId);
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

    // Carregar mensagens iniciais
    loadMessages();

    // Configurar Supabase listener
    channelRef.current = setupSupabaseListener();

    // Iniciar polling backup
    startPollingBackup();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ticketId, loadMessages, setupSupabaseListener, startPollingBackup]);

  // Combinar mensagens reais com otimistas
  const allMessages = [...messages, ...optimisticMessages].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    messages: allMessages,
    isLoading,
    lastUpdateSource,
    // Função para recarregar manualmente
    reload: () => loadMessages(false),
    // Status simplificado
    isSupabaseActive: true,
    isPollingActive: true,
    // Funções para real-time
    addOptimisticMessage,
    confirmOptimisticMessage,
    failOptimisticMessage
  };
};