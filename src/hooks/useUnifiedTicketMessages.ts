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

  // WebSocket Integration - CANAL PRINCIPAL
  const webSocketConfig = {
    clientId,
    instanceId: instanceId || '',
    enabled: !!(instanceId && ticketId),
    onMessage: useCallback((wsMessage: any) => {
      console.log('🔗 [WEBSOCKET] Processando mensagem:', wsMessage);
      
      // Verificar se mensagem é válida
      if (!wsMessage || !wsMessage.messageId) {
        console.warn('⚠️ [WEBSOCKET] Mensagem inválida, ignorando');
        return;
      }

      // Normalizar dados da mensagem para diferentes formatos da API
      const normalizedMessage = {
        messageId: wsMessage.messageId || wsMessage.id || wsMessage.key?.id,
        fromMe: wsMessage.fromMe || wsMessage.key?.fromMe || false,
        content: wsMessage.message?.conversation || wsMessage.message?.extendedTextMessage?.text || wsMessage.content || wsMessage.text || '',
        messageType: wsMessage.messageType || wsMessage.message?.messageType || 'text',
        timestamp: wsMessage.messageTimestamp || wsMessage.timestamp || new Date().toISOString(),
        senderName: wsMessage.pushName || wsMessage.senderName || 'Cliente',
        chatId: wsMessage.key?.remoteJid || wsMessage.chatId,
        mediaUrl: wsMessage.message?.mediaUrl || wsMessage.mediaUrl,
        mediaDuration: wsMessage.message?.mediaDuration || wsMessage.mediaDuration
      };

      // Verificar se é do chat atual (apenas se tivermos chatId)
      if (normalizedMessage.chatId && currentTicketRef.current) {
        const currentChatId = currentTicketRef.current.replace('ticket_', '');
        if (normalizedMessage.chatId !== currentChatId) {
          console.log('📋 [WEBSOCKET] Mensagem de outro chat, ignorando:', normalizedMessage.chatId);
          return;
        }
      }

      // Converter formato para TicketMessage
      const ticketMessage: TicketMessage = {
        id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ticket_id: ticketId,
        message_id: normalizedMessage.messageId,
        from_me: normalizedMessage.fromMe,
        sender_name: normalizedMessage.fromMe ? 'Atendente' : normalizedMessage.senderName,
        content: normalizedMessage.content,
        message_type: normalizedMessage.messageType,
        timestamp: normalizedMessage.timestamp,
        media_url: normalizedMessage.mediaUrl,
        media_duration: normalizedMessage.mediaDuration,
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'completed',
        created_at: new Date().toISOString()
      };

      // Evitar salvar mensagens vazias
      if (!ticketMessage.content && !ticketMessage.media_url) {
        console.warn('⚠️ [WEBSOCKET] Mensagem sem conteúdo, ignorando');
        return;
      }

      // Salvar automaticamente no banco se não for mensagem própria
      if (!normalizedMessage.fromMe) {
        ticketsService.addTicketMessage(ticketMessage).catch(error => {
          console.error('❌ Erro ao salvar mensagem do WebSocket:', error);
        });
      }

      addMessageSafely(ticketMessage, 'websocket');
      lastLoadRef.current = Date.now();
    }, [ticketId, addMessageSafely])
  };

  const { isConnected: wsConnected, isFallbackActive, reconnectAttempts } = useWebSocketRealtime(webSocketConfig);

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

  // Supabase Realtime - CANAL SECUNDÁRIO (backup)
  const setupSupabaseListener = useCallback(() => {
    if (!ticketId) return null;
    
    console.log('🔔 [UNIFIED] Configurando Supabase listener para ticket:', ticketId);
    
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
          // Se WebSocket está ativo, usar com prioridade mais baixa
          if (wsConnected && !isFallbackActive) {
            console.log('📡 [UNIFIED] Supabase update ignorado - WebSocket ativo');
            return;
          }
          
          console.log('📨 [UNIFIED] Mudança via Supabase:', payload.eventType);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            const newMessage = payload.new as TicketMessage;
            
            // Verificar se já existe via WebSocket
            if (!messageIdsRef.current.has(newMessage.message_id)) {
              addMessageSafely(newMessage, 'supabase');
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedMessage = payload.new as TicketMessage;
            setMessages(prev => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
            setLastUpdateSource('supabase');
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setMessages(prev => 
              prev.filter(msg => msg.id !== (payload.old as any).id)
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

  // Polling inteligente otimizado - CANAL TERCIÁRIO (último recurso)
  const startIntelligentPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = setTimeout(() => {
      const timeSinceLastLoad = Date.now() - lastLoadRef.current;
      const shouldPoll = 
        timeSinceLastLoad > 60000 && // 60s sem atualização (aumentado)
        (!wsConnected || isFallbackActive) && // WebSocket não está funcionando
        currentTicketRef.current === ticketId; // Ainda no mesmo ticket

      if (shouldPoll) {
        console.log('🔄 [UNIFIED] Polling de emergência ativado');
        loadMessages(true);
      }
      
      // Intervalo maior para reduzir carga
      startIntelligentPolling();
    }, 45000); // 45s entre verificações
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
    lastUpdateSource,
    // Função para recarregar manualmente
    reload: () => loadMessages(false)
  };
};