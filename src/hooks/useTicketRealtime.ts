
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { aiConfigService } from '@/services/aiConfigService';
import { useAutoReactions } from './useAutoReactions';
import { useHumanizedTyping } from './useHumanizedTyping';
import { useMessageBatch } from './useMessageBatch';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const initializationRef = useRef(false);
  const mountedRef = useRef(false);

  // Hooks para funcionalidades humanizadas
  const autoReactions = useAutoReactions(clientId);
  const humanizedTyping = useHumanizedTyping(clientId);

  // Hook para agrupamento de mensagens
  const messageBatch = useMessageBatch(useCallback(async (chatId: string, messages: any[]) => {
    console.log(`📦 Processando lote de ${messages.length} mensagens para ${chatId}`);
    
    // Processar todas as mensagens em conjunto
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Buscar ticket para este chat
      const ticket = tickets.find(t => t.chat_id === chatId);
      if (ticket) {
        await processWithAssistant(lastMessage, ticket.id, messages);
      } else {
        console.log('⚠️ Ticket não encontrado para chat:', chatId);
      }
    }
  }, [tickets]));

  // Carregar tickets
  const loadTickets = useCallback(async () => {
    if (isLoadingRef.current || !clientId || !mountedRef.current) {
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      console.log('🔄 Carregando tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets carregados:', ticketsData.length);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
    } finally {
      isLoadingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // Processar mensagem com assistente seguindo o fluxo das filas
  const processWithAssistant = useCallback(async (message: any, ticketId: string, messagesBatch?: any[]) => {
    console.log('🤖 Iniciando processamento com assistente para ticket:', ticketId);
    
    // Validar se ticketId é válido
    if (!ticketId || ticketId === '') {
      console.error('❌ Ticket ID inválido:', ticketId);
      return;
    }
    
    const messageKey = `${message.id}_${message.from}_${message.timestamp}`;
    
    if (processedMessagesRef.current.has(message.id) || 
        processedMessagesRef.current.has(messageKey)) {
      console.log('⏭️ Mensagem já processada pelo assistente, ignorando:', message.id);
      return;
    }
    
    processedMessagesRef.current.add(message.id);
    processedMessagesRef.current.add(messageKey);
    
    try {
      // 1. Processar reações automáticas
      if (messagesBatch) {
        for (const msg of messagesBatch) {
          await autoReactions.processMessage(msg);
        }
      } else {
        await autoReactions.processMessage(message);
      }
      
      // 2. Marcar mensagem como lida
      await humanizedTyping.markAsRead(message.from, message.id);
      
      // 3. Buscar configurações do cliente
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig || !aiConfig.openai_api_key) {
        console.log('⚠️ Nenhuma configuração de IA encontrada para cliente:', clientId);
        return;
      }

      // 4. Buscar fila ativa com assistente
      const activeQueue = queues.find((queue: any) => 
        queue.is_active && 
        queue.assistants && 
        queue.assistants.is_active
      );

      if (!activeQueue || !activeQueue.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        return;
      }

      const assistant = activeQueue.assistants;
      console.log(`🤖 Processando com assistente: ${assistant.name} na fila: ${activeQueue.name}`);

      // 5. Atualizar ticket com fila e assistente
      try {
        await supabase
          .from('conversation_tickets')
          .update({
            assigned_queue_id: activeQueue.id,
            assigned_assistant_id: assistant.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId);
        
        console.log('✅ Ticket atualizado com fila e assistente');
      } catch (updateError) {
        console.error('❌ Erro ao atualizar ticket:', updateError);
      }

      // 6. Buscar histórico de mensagens do ticket
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      const recentMessages = ticketMessages
        .slice(-10)
        .map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content || ''
        }));

      // 7. Preparar mensagem contextual
      let messageContent = message.body || message.text || '';
      if (messagesBatch && messagesBatch.length > 1) {
        messageContent = messagesBatch
          .map(msg => msg.body || msg.text || '')
          .filter(text => text.trim())
          .join('\n');
      }

      // 8. Preparar configurações avançadas
      let advancedSettings = {
        temperature: 0.7,
        max_tokens: 1000,
        response_delay_seconds: 3
      };
      
      try {
        if (assistant.advanced_settings) {
          const parsedSettings = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;
          
          advancedSettings = {
            temperature: parsedSettings.temperature || 0.7,
            max_tokens: parsedSettings.max_tokens || 1000,
            response_delay_seconds: parsedSettings.response_delay_seconds || 3
          };
        }
      } catch (error) {
        console.error('Erro ao parse das configurações avançadas:', error);
      }

      // 9. Simular digitação humana
      setAssistantTyping(true);
      const isAudioResponse = assistant.advanced_settings && 
                             typeof assistant.advanced_settings === 'object' && 
                             assistant.advanced_settings !== null &&
                             'voice_cloning_enabled' in assistant.advanced_settings &&
                             assistant.advanced_settings.voice_cloning_enabled === true;
      await humanizedTyping.simulateHumanTyping(message.from, messageContent, isAudioResponse);

      // 10. Chamar a API da OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || aiConfig.default_model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: assistant.prompt || 'Você é um assistente útil que responde de forma amigável e profissional.'
            },
            ...recentMessages,
            {
              role: 'user',
              content: messageContent
            }
          ],
          temperature: advancedSettings.temperature,
          max_tokens: advancedSettings.max_tokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse && assistantResponse.trim()) {
        console.log('🤖 Resposta do assistente gerada:', assistantResponse.substring(0, 100) + '...');
        
        // 11. Enviar resposta via WhatsApp
        await whatsappService.sendMessage(clientId, message.from, assistantResponse);
        
        // 12. Registrar a resposta no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from_me: true,
          sender_name: `🤖 ${assistant.name} (${activeQueue.name})`,
          content: assistantResponse,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: true,
          ai_confidence_score: data.choices?.[0]?.finish_reason === 'stop' ? 0.9 : 0.7,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta automática enviada e registrada');
      }

    } catch (error) {
      console.error('❌ Erro ao processar com assistente:', error);
    } finally {
      setAssistantTyping(false);
    }
  }, [clientId, autoReactions, humanizedTyping]);

  // Extrair nome real do WhatsApp
  const extractWhatsAppName = useCallback((message: any) => {
    const possibleNames = [
      message.notifyName,
      message.pushName, 
      message.senderName,
      message.author,
      message.sender
    ];

    for (const name of possibleNames) {
      if (name && 
          typeof name === 'string' && 
          name.trim() !== '' && 
          !name.includes('@') && 
          name.length > 1) {
        return name.trim();
      }
    }

    const phone = message.from?.replace(/\D/g, '') || '';
    if (phone.length >= 10) {
      const formattedPhone = phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      return formattedPhone;
    }

    return `Contato ${phone || 'Desconhecido'}`;
  }, []);

  // Configurar listeners - EVITANDO LOOPS
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Configurando listeners de tempo real para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    // Carregar tickets inicial
    loadTickets();

    // Conectar ao WebSocket do WhatsApp
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      whatsappService.joinClientRoom(clientId);
      setIsOnline(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
      setIsOnline(false);
    });

    if (socket.connected) {
      whatsappService.joinClientRoom(clientId);
      setIsOnline(true);
    }

    // Listener para novas mensagens do WhatsApp
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida:', {
        id: message.id,
        from: message.from,
        body: message.body?.substring(0, 50),
        fromMe: message.fromMe,
        timestamp: message.timestamp
      });
      
      const messageKey = `${message.id}_${message.from}_${message.timestamp}`;
      
      if (processedMessagesRef.current.has(message.id) || 
          processedMessagesRef.current.has(messageKey)) {
        console.log('⏭️ Mensagem já processada, ignorando:', message.id);
        return;
      }
      
      // Ignorar mensagens próprias
      if (message.fromMe) {
        console.log('⏭️ Ignorando mensagem própria');
        return;
      }
      
      try {
        // Criar/atualizar ticket
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from || message.chatId,
          message.instanceId || clientId,
          extractWhatsAppName(message),
          message.from?.replace(/\D/g, '') || '',
          message.body || '',
          new Date().toISOString()
        );

        console.log('📋 Ticket criado/atualizado:', ticketId);

        // Adicionar mensagem ao agrupamento E processar imediatamente
        messageBatch.addMessage(message);
        
        // Processar imediatamente se não estiver no batch
        setTimeout(async () => {
          try {
            await processWithAssistant(message, ticketId);
          } catch (error) {
            console.error('❌ Erro no processamento imediato:', error);
          }
        }, 1000);
        
      } catch (error) {
        console.error('❌ Erro ao processar nova mensagem:', error);
      }
    };

    const messageEvent = `message_${clientId}`;
    socket.on(messageEvent, handleNewWhatsAppMessage);

    // Listener para atualizações de tickets no Supabase
    const channel = supabase
      .channel(`ticket-updates-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        async (payload) => {
          console.log('🔄 Ticket atualizado via Supabase:', payload.eventType);
          
          // Debounce para evitar muitas chamadas
          setTimeout(() => {
            if (!isLoadingRef.current && mountedRef.current) {
              loadTickets();
            }
          }, 1000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 Limpando listeners...');
      initializationRef.current = false;
      mountedRef.current = false;
      
      if (socketRef.current) {
        socketRef.current.off(messageEvent, handleNewWhatsAppMessage);
        socketRef.current.disconnect();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      processedMessagesRef.current.clear();
      setIsOnline(false);
    };
  }, [clientId, loadTickets, extractWhatsAppName, messageBatch, processWithAssistant]);

  const reloadTickets = useCallback(() => {
    console.log('🔄 Recarregamento manual solicitado');
    if (!isLoadingRef.current && mountedRef.current) {
      loadTickets();
    }
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline,
    reloadTickets
  };
};
