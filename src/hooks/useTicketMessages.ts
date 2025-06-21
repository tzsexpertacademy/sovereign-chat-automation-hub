
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';

export const useTicketMessages = (ticketId: string | null) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<any>(null);

  // Carregar mensagens do ticket
  const loadMessages = async () => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    try {
      setIsLoading(true);
      const messagesData = await ticketsService.getTicketMessages(ticketId);
      setMessages(messagesData);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    loadMessages();

    // Remover canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Configurar listener para novas mensagens deste ticket
    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        async (payload) => {
          console.log('💬 Nova mensagem no ticket:', payload);
          // Adicionar nova mensagem à lista sem recarregar tudo
          const newMessage = payload.new as TicketMessage;
          setMessages(prev => [...prev, newMessage]);
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
        async (payload) => {
          console.log('📝 Mensagem atualizada:', payload);
          const updatedMessage = payload.new as TicketMessage;
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id ? updatedMessage : msg
          ));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ticketId]);

  return {
    messages,
    isLoading,
    reloadMessages: loadMessages
  };
};
