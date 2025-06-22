
import { useState, useEffect } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

export const useTicketMessages = (ticketId: string) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 Carregando mensagens para ticket:', ticketId);
        
        const messagesData = await ticketsService.getTicketMessages(ticketId, 100);
        console.log(`📨 ${messagesData.length} mensagens carregadas`);
        
        setMessages(messagesData);
      } catch (error) {
        console.error('❌ Erro ao carregar mensagens:', error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();

    // Configurar listener para novas mensagens
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
          console.log('🔔 Nova mensagem recebida:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as TicketMessage;
            setMessages(prev => {
              // Evitar duplicatas
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              // Inserir na posição correta (ordenado por timestamp)
              const newMessages = [...prev, newMessage];
              return newMessages.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as TicketMessage;
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => 
              prev.filter(msg => msg.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return { messages, isLoading };
};
