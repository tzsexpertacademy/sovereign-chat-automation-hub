import { useState, useEffect, useRef, useCallback } from 'react';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { useWebSocketRealtime } from './useWebSocketRealtime';

interface UnifiedTicketMessagesConfig {
  ticketId: string;
  clientId: string;
  instanceId?: string;
}

export const useUnifiedTicketMessages = ({ ticketId, clientId, instanceId }: UnifiedTicketMessagesConfig) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateSource, setLastUpdateSource] = useState<'websocket' | 'supabase' | 'polling'>('polling');
  
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadRef = useRef<number>(0);
  const channelRef = useRef<any>(null);
  const currentTicketRef = useRef<string>('');
  const messageIdsRef = useRef<Set<string>>(new Set());

  // Função para adicionar mensagem sem duplicatas
  const addMessageSafely = useCallback((newMessage: TicketMessage, source: 'websocket' | 'supabase' | 'polling') => {
    setMessages(prev => {
      const exists = prev.some(msg => msg.message_id === newMessage.message_id);
      if (exists) return prev;

      // Adicionar ao Set para controle de duplicatas
      messageIdsRef.current.add(newMessage.message_id);
      setLastUpdateSource(source);
      
      const updated = [...prev, newMessage].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      console.log(`📨 [UNIFIED-MESSAGES] Nova mensagem via ${source}:`, {
        messageId: newMessage.message_id,
        content: newMessage.content?.substring(0, 50) + '...',
        fromMe: newMessage.from_me,
        totalMessages: updated.length
      });
      
      return updated;
    });
  }, []);

  // WebSocket Integration - PRIORIDADE MÁXIMA 
  const webSocketConfig = {
    clientId,
    instanceId: instanceId || '',
    enabled: !!(instanceId && ticketId),
    onMessage: useCallback((wsMessage: any) => {
      console.log('📨 [UNIFIED] *** MENSAGEM WEBSOCKET RECEBIDA ***:', wsMessage);
      
      if (!wsMessage || !wsMessage.messageId) {
        console.warn('⚠️ [UNIFIED] Mensagem WebSocket inválida');
        return;
      }

      try {
        // Converter mensagem WebSocket para formato TicketMessage
        const ticketMessage: TicketMessage = {
          id: `ws_${wsMessage.messageId}_${Date.now()}`,
          ticket_id: ticketId,
          message_id: wsMessage.messageId,
          from_me: wsMessage.keyFromMe || false,
          sender_name: wsMessage.pushName || (wsMessage.keyFromMe ? 'Atendente' : 'Cliente'),
          content: wsMessage.content?.text || wsMessage.content || '[SEM CONTEÚDO]',
          message_type: wsMessage.contentType || 'text',
          timestamp: wsMessage.messageTimestamp 
            ? new Date(Number(wsMessage.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString(),
          media_url: null,
          media_duration: null,
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          created_at: new Date().toISOString()
        };

        console.log('✅ [UNIFIED] *** MENSAGEM WEBSOCKET PROCESSADA ***:', {
          messageId: ticketMessage.message_id,
          fromMe: ticketMessage.from_me,
          content: ticketMessage.content?.substring(0, 50)
        });

        // Salvar no banco se for mensagem de cliente
        if (!ticketMessage.from_me && ticketMessage.content?.trim()) {
          ticketsService.addTicketMessage(ticketMessage).catch(error => {
            console.error('❌ [UNIFIED] Erro ao salvar mensagem WebSocket:', error);
          });
        }

        // Adicionar à lista com máxima prioridade
        addMessageSafely(ticketMessage, 'websocket');
        lastLoadRef.current = Date.now();

        console.log('🎉 [UNIFIED] *** MENSAGEM WEBSOCKET ADICIONADA COM SUCESSO ***');

      } catch (error) {
        console.error('❌ [UNIFIED] Erro ao processar mensagem WebSocket:', error);
      }
    }, [ticketId, instanceId, addMessageSafely])
  };

  const { 
    isConnected: wsConnected, 
    isFallbackActive, 
    reconnectAttempts,
    isCircuitBreakerBlocked,
    circuitBreakerUnblockTime
  } = useWebSocketRealtime(webSocketConfig);

  // Carregar mensagens iniciais
  const loadMessages = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setIsLoading(true);
      
      console.log(`🔄 [UNIFIED] ${isPolling ? 'Polling' : 'Carregando'} mensagens para ticket:`, ticketId);
      
      const messagesData = await ticketsService.getTicketMessages(ticketId, 1000);
      
      // Reset do controle de duplicatas
      messageIdsRef.current.clear();
      messagesData.forEach(msg => messageIdsRef.current.add(msg.message_id));
      
      setMessages(messagesData);
      lastLoadRef.current = Date.now();
      setLastUpdateSource('polling');
      
      console.log(`📨 [UNIFIED] ${messagesData.length} mensagens carregadas via ${isPolling ? 'polling' : 'inicial'}`);
    } catch (error) {
      console.error('❌ [UNIFIED] Erro ao carregar mensagens:', error);
      if (!isPolling) setMessages([]);
    } finally {
      if (!isPolling) setIsLoading(false);
    }
  }, [ticketId]);

  // Supabase Realtime - FALLBACK quando WebSocket falha
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    console.log('🔔 [UNIFIED] Configurando Supabase listener (fallback)...');
    
    const channel = supabase
      .channel(`unified-ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          // PRIORIDADE: WebSocket > Supabase > Polling
          if (wsConnected && !isFallbackActive) {
            console.log('⏭️ [UNIFIED] Supabase ignorado - WebSocket ativo');
            return;
          }
          
          console.log('📨 [UNIFIED] Mudança via Supabase (fallback):', payload.eventType);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new as TicketMessage;
            
            // Verificar duplicatas
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
          
          lastLoadRef.current = Date.now();
        }
      )
      .subscribe((status) => {
        console.log('📡 [UNIFIED] Supabase status:', status);
      });

    return channel;
  }, [ticketId, wsConnected, isFallbackActive, addMessageSafely]);

  // Polling inteligente - ÚLTIMO RECURSO quando tudo falha
  const startIntelligentPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      const timeSinceLastLoad = Date.now() - lastLoadRef.current;
      const shouldPoll = 
        timeSinceLastLoad > 30000 && // 30s sem atualização
        (!wsConnected || isFallbackActive) && // WebSocket não funcionando
        currentTicketRef.current === ticketId; // Mesmo ticket

      if (shouldPoll) {
        console.log('🔄 [UNIFIED] *** POLLING DE EMERGÊNCIA ATIVADO ***');
        loadMessages(true);
      } else if (wsConnected && !isFallbackActive) {
        console.log('✅ [UNIFIED] *** POLLING DESABILITADO - WEBSOCKET ATIVO ***');
      }
      
      startIntelligentPolling();
    }, 20000); // Verificar a cada 20s
  }, [ticketId, wsConnected, isFallbackActive, loadMessages]);

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

    console.log('🔄 [UNIFIED] Inicializando para ticket:', ticketId);
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

    // Iniciar polling inteligente
    startIntelligentPolling();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ticketId, loadMessages, setupSupabaseListener, startIntelligentPolling]);

  return {
    messages,
    isLoading,
    // Status info para debug
    wsConnected,
    isFallbackActive,
    reconnectAttempts,
    isCircuitBreakerBlocked,
    circuitBreakerUnblockTime,
    lastUpdateSource,
    // Função para recarregar manualmente
    reload: () => loadMessages(false)
  };
};