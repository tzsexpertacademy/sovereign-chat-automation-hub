
import { useState, useEffect, useRef } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';

export const useTicketMessages = (ticketId: string) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadRef = useRef<number>(0);
  const realtimeConnectedRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;

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
        
        // Polling apenas se realtime falhou ou muito tempo sem sync
        if (!realtimeConnectedRef.current || timeSinceLastLoad > 45000) {
          console.log(`🔄 Polling backup (realtime: ${realtimeConnectedRef.current ? 'OK' : 'FALHA'})`);
          loadMessages(true);
        }
        startPolling();
      }, 30000); // Otimizado para 30 segundos
    };

    // Função para tentar reconectar realtime
    const tryReconnectRealtime = () => {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn('⚠️ Máximo de tentativas de reconexão atingido, usando apenas polling');
        realtimeConnectedRef.current = false;
        return;
      }

      reconnectAttemptsRef.current++;
      console.log(`🔄 Tentativa de reconexão realtime #${reconnectAttemptsRef.current}`);
      
      setTimeout(() => {
        setupRealtimeListener();
      }, 2000 * reconnectAttemptsRef.current); // Backoff progressivo
    };

    // Configurar listener realtime
    const setupRealtimeListener = () => {
      console.log('🔔 Configurando listener para mensagens do ticket:', ticketId);
      
      const channel = supabase
        .channel(`ticket-messages-${ticketId}`) // Canal único para este ticket
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
            
            // Atualizar timestamp do último carregamento
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
                // Verificação melhorada de duplicatas
                const exists = prev.some(msg => {
                  // Verificação por ID exato
                  if (msg.id === newMessage.id || (msg.message_id && msg.message_id === newMessage.message_id)) {
                    return true;
                  }
                  
                  // Para mensagens próprias (from_me: true), verificar por conteúdo + timestamp próximo
                  if (newMessage.from_me && msg.from_me) {
                    const timeDiff = Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime());
                    const sameContent = msg.content?.trim() === newMessage.content?.trim();
                    
                    // Se mesmo conteúdo e timestamp próximo (até 30 segundos), é duplicata
                    if (sameContent && timeDiff < 30000) {
                      console.log('🔍 Duplicata detectada por conteúdo+tempo:', {
                        existingId: msg.id,
                        newId: newMessage.id,
                        timeDiff: timeDiff + 'ms',
                        content: msg.content?.substring(0, 30)
                      });
                      return true;
                    }
                  }
                  
                  return false;
                });
                
                if (exists) {
                  console.log('⚠️ Mensagem já existe, ignorando duplicata:', {
                    messageId: newMessage.message_id,
                    fromMe: newMessage.from_me,
                    content: newMessage.content?.substring(0, 30)
                  });
                  return prev;
                }
                
                // Inserir na posição correta
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
                  msg.id === updatedMessage.id || 
                  (msg.message_id && msg.message_id === updatedMessage.message_id)
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
            reconnectAttemptsRef.current = 0; // Reset tentativas
            startPolling(); // Manter polling como backup
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('⚠️ Problema no realtime, tentando reconectar...');
            realtimeConnectedRef.current = false;
            tryReconnectRealtime();
            startPolling(); // Ativar polling como principal
          } else if (status === 'CLOSED') {
            console.warn('🔌 Realtime desconectado');
            realtimeConnectedRef.current = false;
            tryReconnectRealtime();
          }
        });

      return channel;
    };

    const channel = setupRealtimeListener();
    startPolling();

    return () => {
      console.log('🔌 Removendo listener de mensagens para ticket:', ticketId);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      realtimeConnectedRef.current = false;
      reconnectAttemptsRef.current = 0;
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return { messages, isLoading };
};
