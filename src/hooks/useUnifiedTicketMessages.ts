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

  // WebSocket Integration - CANAL PRINCIPAL com Socket.IO
  const webSocketConfig = {
    clientId,
    instanceId: instanceId || '',
    enabled: !!(instanceId && ticketId),
    onMessage: useCallback((wsMessage: any) => {
      console.log('🎯 [FASE-4] PROCESSAMENTO AVANÇADO de mensagem Socket.IO:', wsMessage);
      
      // 🔍 VALIDAÇÃO RIGOROSA BASEADA NOS LOGS REAIS
      if (!wsMessage || !wsMessage.messageId || !wsMessage.instanceInstanceId) {
        console.warn('❌ [FASE-4] MENSAGEM INVÁLIDA - campos obrigatórios ausentes:', {
          hasMessage: !!wsMessage,
          hasMessageId: !!wsMessage?.messageId,
          hasInstanceId: !!wsMessage?.instanceInstanceId,
          receivedKeys: Object.keys(wsMessage || {})
        });
        return;
      }

      // ✅ VERIFICAR INSTÂNCIA (segurança)
      if (wsMessage.instanceInstanceId !== instanceId) {
        console.log('📋 [FASE-4] Mensagem de instância diferente ignorada:', {
          recebidaDe: wsMessage.instanceInstanceId,
          esperado: instanceId
        });
        return;
      }

      // 🎯 PROCESSAMENTO BASEADO NA ESTRUTURA REAL DOS LOGS
      try {
        // Extrair dados conforme estrutura real: 
        // messageId, keyFromMe, keyRemoteJid, pushName, contentType, content: { text }, messageTimestamp
        const messagePhone = wsMessage.keyRemoteJid?.replace(/@(s\.whatsapp\.net|c\.us)$/, '') || 'Desconhecido';
        
        // ✅ NORMALIZAÇÃO ROBUSTA
        const normalizedMessage = {
          messageId: wsMessage.messageId,
          fromMe: Boolean(wsMessage.keyFromMe),
          contentType: wsMessage.contentType || 'text',
          content: wsMessage.content?.text || 
                   wsMessage.content?.caption || 
                   JSON.stringify(wsMessage.content || {}),
          timestamp: wsMessage.messageTimestamp 
            ? new Date(Number(wsMessage.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString(),
          senderName: wsMessage.pushName || (wsMessage.keyFromMe ? 'Atendente' : `Cliente ${messagePhone}`),
          chatId: wsMessage.keyRemoteJid,
          isGroup: Boolean(wsMessage.isGroup),
          source: wsMessage.source || 'websocket-realtime'
        };

        // 🎯 CONVERTER PARA FORMATO TICKET MESSAGE
        const ticketMessage: TicketMessage = {
          id: `ws_${wsMessage.messageId}_${Date.now()}`,
          ticket_id: ticketId,
          message_id: normalizedMessage.messageId,
          from_me: normalizedMessage.fromMe,
          sender_name: normalizedMessage.senderName,
          content: normalizedMessage.content,
          message_type: normalizedMessage.contentType,
          timestamp: normalizedMessage.timestamp,
          media_url: null,
          media_duration: null,
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'completed',
          created_at: new Date().toISOString()
        };

        // ⚠️ VALIDAÇÃO DE CONTEÚDO
        if (!ticketMessage.content || ticketMessage.content.trim() === '' || ticketMessage.content === '{}') {
          console.warn('⚠️ [FASE-4] Mensagem sem conteúdo válido, mas processando mesmo assim:', {
            messageId: ticketMessage.message_id,
            contentType: ticketMessage.message_type,
            originalContent: wsMessage.content
          });
          ticketMessage.content = `[${ticketMessage.message_type.toUpperCase()}]`;
        }

        console.log('✅ [FASE-4] MENSAGEM PROCESSADA COM SUCESSO:', {
          messageId: ticketMessage.message_id,
          fromMe: ticketMessage.from_me,
          contentPreview: ticketMessage.content.substring(0, 100),
          sender: ticketMessage.sender_name,
          type: ticketMessage.message_type
        });

        // 💾 SALVAR NO BANCO (apenas mensagens de clientes)
        if (!normalizedMessage.fromMe) {
          ticketsService.addTicketMessage(ticketMessage).catch(error => {
            console.error('❌ [FASE-4] ERRO ao salvar mensagem:', error);
          });
        }

        // 🔄 ADICIONAR À LISTA DE MENSAGENS
        addMessageSafely(ticketMessage, 'websocket');
        lastLoadRef.current = Date.now();

        console.log('🎉 [FASE-4] MENSAGEM ADICIONADA COM SUCESSO VIA WEBSOCKET!');

      } catch (error) {
        console.error('❌ [FASE-4] ERRO CRÍTICO no processamento:', error, {
          originalMessage: wsMessage
        });
      }
    }, [ticketId, instanceId, addMessageSafely])
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