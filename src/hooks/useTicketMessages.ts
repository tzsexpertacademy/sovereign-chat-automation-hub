
import { useState, useEffect, useRef } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

export const useTicketMessages = (ticketId: string) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadRef = useRef<number>(0);
  const realtimeConnectedRef = useRef<boolean>(false);

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

    // Polling como fallback (só se realtime não estiver funcionando)
    const startPolling = () => {
      pollTimeoutRef.current = setTimeout(() => {
        const timeSinceLastLoad = Date.now() - lastLoadRef.current;
        // Só faz polling se realtime não estiver conectado E passou mais de 25 segundos
        if (!realtimeConnectedRef.current && timeSinceLastLoad > 25000) {
          console.log('🔄 Polling de backup executado (realtime não conectado)');
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
              content: newMessage.content.substring(0, 50),
              messageId: newMessage.message_id
            });
            
            setMessages(prev => {
              // Evitar duplicatas usando message_id único
              const exists = prev.some(msg => 
                msg.id === newMessage.id || 
                msg.message_id === newMessage.message_id
              );
              if (exists) {
                console.log('⚠️ Mensagem já existe, ignorando duplicata:', newMessage.message_id);
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
              prev.map(msg => 
                msg.id === updatedMessage.id || msg.message_id === updatedMessage.message_id 
                  ? updatedMessage 
                  : msg
              )
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            console.log('🗑️ Mensagem removida via realtime:', (payload.old as any).id);
            
            setMessages(prev => 
              prev.filter(msg => 
                msg.id !== (payload.old as any).id && 
                msg.message_id !== (payload.old as any).message_id
              )
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da subscription para mensagens:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado com sucesso');
          realtimeConnectedRef.current = true;
          startPolling(); // Ainda manter polling como backup extremo
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Problema no realtime, ativando polling como principal');
          realtimeConnectedRef.current = false;
          startPolling();
        } else if (status === 'CLOSED') {
          console.warn('🔌 Realtime desconectado');
          realtimeConnectedRef.current = false;
        }
      });

    return () => {
      console.log('🔌 Removendo listener de mensagens para ticket:', ticketId);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      realtimeConnectedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return { messages, isLoading };
};
