
import { useState, useEffect, useRef } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

export const useTicketMessages = (ticketId: string) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadRef = useRef<number>(0);

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    const loadMessages = async (isPolling = false) => {
      try {
        if (!isPolling) setIsLoading(true);
        
        console.log(`🔄 ${isPolling ? 'Polling' : 'Carregando'} mensagens para ticket:`, ticketId);
        
        const messagesData = await ticketsService.getTicketMessages(ticketId, 100);
        console.log(`📨 ${messagesData.length} mensagens carregadas para ticket ${ticketId}`);
        
        setMessages(messagesData);
        lastLoadRef.current = Date.now();
      } catch (error) {
        console.error('❌ Erro ao carregar mensagens:', error);
        if (!isPolling) setMessages([]);
      } finally {
        if (!isPolling) setIsLoading(false);
      }
    };

    // Carregamento inicial
    loadMessages();

    // Polling como fallback (a cada 30 segundos)
    const startPolling = () => {
      pollTimeoutRef.current = setTimeout(() => {
        const timeSinceLastLoad = Date.now() - lastLoadRef.current;
        // Só faz polling se passou mais de 25 segundos desde o último carregamento
        if (timeSinceLastLoad > 25000) {
          loadMessages(true);
        }
        startPolling(); // Continuar polling
      }, 30000);
    };

    // Configurar listener para novas mensagens em tempo real
    console.log('🔔 Configurando listener para mensagens do ticket:', ticketId);
    
    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('🔔 Mudança na tabela ticket_messages detectada:', {
            event: payload.eventType,
            messageId: (payload.new as any)?.id || (payload.old as any)?.id,
            content: (payload.new as any)?.content?.substring(0, 50) || 'N/A'
          });
          
          // Atualizar timestamp do último carregamento para evitar polling desnecessário
          lastLoadRef.current = Date.now();
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new as TicketMessage;
            console.log('📨 Nova mensagem recebida via realtime:', {
              id: newMessage.id,
              fromMe: newMessage.from_me,
              content: newMessage.content.substring(0, 50)
            });
            
            setMessages(prev => {
              // Evitar duplicatas
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log('⚠️ Mensagem já existe, ignorando duplicata');
                return prev;
              }
              
              // Inserir na posição correta (ordenado por timestamp)
              const newMessages = [...prev, newMessage];
              const sortedMessages = newMessages.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              
              console.log('✅ Mensagem adicionada à lista, total:', sortedMessages.length);
              return sortedMessages;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedMessage = payload.new as TicketMessage;
            console.log('🔄 Mensagem atualizada via realtime:', updatedMessage.id);
            
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            console.log('🗑️ Mensagem removida via realtime:', (payload.old as any).id);
            
            setMessages(prev => 
              prev.filter(msg => msg.id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da subscription para mensagens:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado, iniciando polling de backup');
          startPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Problema no realtime, dependendo apenas do polling');
          startPolling();
        }
      });

    return () => {
      console.log('🔌 Removendo listener de mensagens para ticket:', ticketId);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return { messages, isLoading };
};
