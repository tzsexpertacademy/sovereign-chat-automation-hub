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
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');
  const messageIdsRef = useRef<Set<string>>(new Set());

  // Função para adicionar mensagem sem duplicatas
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'supabase' | 'polling') => {
    setMessages(prev => {
      const exists = prev.some(msg => msg.message_id === newMessage.message_id);
      if (exists) return prev;

      messageIdsRef.current.add(newMessage.message_id);
      setLastUpdateSource(source);
      
      const updated = [...prev, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      console.log(`📨 [SIMPLE-MESSAGES] Nova mensagem via ${source}:`, {
        messageId: newMessage.message_id,
        content: newMessage.content?.substring(0, 50) + '...',
        fromMe: newMessage.from_me,
        totalMessages: updated.length
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

  // Supabase Realtime - MÉTODO PRINCIPAL
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    console.log('🔔 [SIMPLE-MESSAGES] Configurando Supabase Realtime');
    
    const channel = supabase
      .channel(`simple-ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('📨 [SIMPLE-MESSAGES] Mudança via Supabase:', payload.eventType);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new as TicketMessage;
            
            console.log('✅ [SIMPLE-MESSAGES] Nova mensagem:', {
              messageId: newMessage.message_id,
              content: newMessage.content?.substring(0, 50),
              fromMe: newMessage.from_me
            });
            
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
        console.log('📡 [SIMPLE-MESSAGES] Supabase status:', status);
      });

    return channel;
  }, [ticketId, addMessageSafely]);

  // Polling backup - a cada 30 segundos
  const startPollingBackup = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      if (currentTicketRef.current === ticketId) {
        console.log('🔄 [SIMPLE-MESSAGES] Polling backup');
        loadMessages(true);
        startPollingBackup();
      }
    }, 30000); // 30 segundos
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

  return {
    messages,
    isLoading,
    lastUpdateSource,
    // Função para recarregar manualmente
    reload: () => loadMessages(false),
    // Status simplificado
    isSupabaseActive: true,
    isPollingActive: true
  };
};