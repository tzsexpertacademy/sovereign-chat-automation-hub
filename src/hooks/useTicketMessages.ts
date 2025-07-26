
import { useState, useEffect, useRef } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

export const useTicketMessages = (ticketId: string) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadRef = useRef<number>(0);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }

    // Sempre limpar mensagens ao trocar de ticket
    console.log('🔄 Carregando mensagens para ticket:', ticketId);
    setMessages([]);
    setIsLoading(true);

    const loadMessages = async (isPolling = false) => {
      try {
        if (!isPolling) setIsLoading(true);
        
        console.log(`🔄 ${isPolling ? 'Polling' : 'Carregando'} mensagens para ticket:`, ticketId);
        
        // Carregar TODAS as mensagens sem limite
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

    // Sempre carregar mensagens ao trocar de ticket
    loadMessages();

    // Polling otimizado (30 segundos ou quando necessário)
    const startPolling = () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      
      pollTimeoutRef.current = setTimeout(() => {
        const timeSinceLastLoad = Date.now() - lastLoadRef.current;
        
        // Polling como backup
        if (timeSinceLastLoad > 45000) {
          console.log('🔄 Polling backup');
          loadMessages(true);
        }
        startPolling();
      }, 30000); // Otimizado para 30 segundos
    };

    // Configurar listener realtime simplificado
    const setupRealtimeListener = () => {
      console.log('🔔 Configurando listener para mensagens do ticket:', ticketId);
      
      const channel = supabase
        .channel(`ticket-messages-${ticketId}-${Date.now()}`) // Canal único com timestamp
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
            
            lastLoadRef.current = Date.now();
            
            if (payload.eventType === 'INSERT' && payload.new) {
              const newMessage = payload.new as TicketMessage;
              console.log('📨 Nova mensagem recebida via realtime:', {
                id: newMessage.id,
                fromMe: newMessage.from_me,
                content: newMessage.content.substring(0, 50),
                messageId: newMessage.message_id
              });
              
              setMessages(prev => {
                const exists = prev.some(msg => 
                  msg.id === newMessage.id || 
                  (msg.message_id && msg.message_id === newMessage.message_id)
                );
                
                if (exists) {
                  console.log('⚠️ Mensagem já existe, ignorando duplicata');
                  return prev;
                }
                
                const newMessages = [...prev, newMessage];
                return newMessages.sort((a, b) => 
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedMessage = payload.new as TicketMessage;
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === updatedMessage.id ? updatedMessage : msg
                )
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setMessages(prev => 
                prev.filter(msg => msg.id !== (payload.old as any).id)
              );
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Status da subscription para mensagens:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime conectado');
          }
        });

      return channel;
    };

    // Limpar canal anterior se existir
    if (channelRef.current) {
      console.log('🔌 Removendo canal anterior');
      supabase.removeChannel(channelRef.current);
    }

    // Criar novo canal
    channelRef.current = setupRealtimeListener();
    startPolling();

    return () => {
      console.log('🔌 Removendo listener de mensagens para ticket:', ticketId);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [ticketId]);

  return { messages, isLoading };
};
