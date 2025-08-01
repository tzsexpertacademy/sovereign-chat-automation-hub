
import { useState, useEffect, useRef } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

export const useTicketMessages = (ticketId: string) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadRef = useRef<number>(0);
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    // Se é o mesmo ticket, não recriar
    if (currentTicketRef.current === ticketId && channelRef.current) {
      return;
    }

    console.log('🔄 Carregando mensagens para ticket:', ticketId);
    setMessages([]);
    setIsLoading(true);
    currentTicketRef.current = ticketId;

    const loadMessages = async (isPolling = false) => {
      try {
        if (!isPolling) setIsLoading(true);
        
        console.log(`🔄 ${isPolling ? 'Polling' : 'Carregando'} mensagens para ticket:`, ticketId);
        
        const messagesData = await ticketsService.getTicketMessages(ticketId, 1000);
        console.log(`📨 ${messagesData.length} mensagens carregadas para ticket ${ticketId}`);
        
        setMessages(messagesData);
        lastLoadRef.current = Date.now();
        
        if (isPolling && messagesData.length > 0) {
          console.log('✅ Polling detectou mudanças, mensagens atualizadas');
        }
      } catch (error) {
        console.error('❌ Erro ao carregar mensagens:', error);
        if (!isPolling) setMessages([]);
      } finally {
        if (!isPolling) setIsLoading(false);
      }
    };

    loadMessages();

    // Cleanup função
    const cleanup = () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (channelRef.current) {
        console.log('🔌 Removendo canal anterior');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    // Limpar recursos anteriores
    cleanup();

    // Polling simplificado
    const startPolling = () => {
      pollTimeoutRef.current = setTimeout(() => {
        const timeSinceLastLoad = Date.now() - lastLoadRef.current;
        if (timeSinceLastLoad > 30000) {
          console.log('🔄 Polling backup');
          loadMessages(true);
        }
        startPolling();
      }, 30000);
    };

    // Configurar realtime simplificado
    const setupRealtimeListener = () => {
      console.log('🔔 Configurando listener para mensagens do ticket:', ticketId);
      
      const channel = supabase
        .channel(`ticket-${ticketId}`) // Nome simples e único por ticket
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ticket_messages',
            filter: `ticket_id=eq.${ticketId}`
          },
          (payload) => {
            console.log('📨 Mudança via realtime:', payload.eventType);
            lastLoadRef.current = Date.now();
            
            if (payload.eventType === 'INSERT' && payload.new) {
              const newMessage = payload.new as TicketMessage;
              console.log('📨 Nova mensagem via realtime:', {
                messageId: newMessage.message_id,
                type: newMessage.message_type,
                fromMe: newMessage.from_me,
                hasAudio: !!newMessage.audio_base64
              });
              setMessages(prev => {
                const exists = prev.some(msg => msg.id === newMessage.id);
                if (exists) return prev;
                
                return [...prev, newMessage].sort((a, b) => 
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedMessage = payload.new as TicketMessage;
              console.log('🔄 Mensagem atualizada via realtime:', {
                messageId: updatedMessage.message_id,
                status: updatedMessage.processing_status,
                type: updatedMessage.message_type,
                hasAudio: !!updatedMessage.audio_base64,
                fromMe: updatedMessage.from_me
              });
              
              // ⚡ OTIMIZAÇÃO: Detectar áudios CRM que acabaram de ficar prontos
              if (updatedMessage.message_type === 'audio' && 
                  updatedMessage.from_me && 
                  updatedMessage.processing_status === 'completed' &&
                  updatedMessage.audio_base64) {
                console.log('⚡ Áudio CRM detectado como pronto via realtime - forçando atualização');
              }
              
              setMessages(prev => 
                prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setMessages(prev => 
                prev.filter(msg => msg.id !== (payload.old as any).id)
              );
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Status da subscription:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime conectado');
          }
        });

      return channel;
    };

    // Configurar recursos
    try {
      channelRef.current = setupRealtimeListener();
      startPolling();
    } catch (error) {
      console.error('❌ Erro ao configurar realtime:', error);
      startPolling(); // Fallback para polling apenas
    }

    return cleanup;
  }, [ticketId]);

  return { messages, isLoading };
};
