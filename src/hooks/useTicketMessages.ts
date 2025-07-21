
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
        console.log(`📨 ${messagesData.length} mensagens carregadas para ticket ${ticketId}`);
        
        setMessages(messagesData);
      } catch (error) {
        console.error('❌ Erro ao carregar mensagens:', error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();

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
      });

    return () => {
      console.log('🔌 Removendo listener de mensagens para ticket:', ticketId);
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return { messages, isLoading };
};
