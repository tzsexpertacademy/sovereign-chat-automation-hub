import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { aiConfigService } from '@/services/aiConfigService';
import { useMessageBatch } from './useMessageBatch';
import { useHumanizedTyping } from './useHumanizedTyping';
import { useOnlineStatus } from './useOnlineStatus';
import { useAutoReactions } from './useAutoReactions';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const channelRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const lastMessageIdRef = useRef<string>('');
  const socketRef = useRef<any>(null);
  const processingQueueRef = useRef<Set<string>>(new Set());
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef(false);

  // Hook para delay humanizado - com useCallback para estabilizar
  const { isTyping, sendWithTypingDelay } = useHumanizedTyping({
    baseDelay: 2000,
    charDelay: 60,
    maxDelay: 10000,
    minDelay: 3000
  });

  // Sincronizar estado de typing do assistente
  useEffect(() => {
    setAssistantTyping(isTyping);
  }, [isTyping]);

  // Carregar tickets com debounce rigoroso para evitar loops
  const loadTickets = useCallback(async (skipLoadingCheck = false) => {
    if (!skipLoadingCheck && (isLoadingRef.current || !clientId)) {
      console.log('⏭️ LoadTickets ignorado - já carregando ou sem clientId');
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      console.log('🔄 Carregando tickets para cliente:', clientId);
      
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets carregados:', ticketsData.length);
      
      setTickets(ticketsData);
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [clientId]);

  // Hooks para status online e reações automáticas
  const { isOnline, markActivity } = useOnlineStatus(clientId, true);
  const { processMessage: processAutoReaction, isProcessing: isProcessingReaction } = useAutoReactions(clientId, true);

  // Função para extrair nome real do WhatsApp
  const extractWhatsAppName = useCallback((message: any) => {
    console.log('🔍 Extraindo nome da mensagem:', {
      notifyName: message.notifyName,
      pushName: message.pushName,
      senderName: message.senderName,
      author: message.author,
      from: message.from
    });

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
        console.log('✅ Nome extraído:', name.trim());
        return name.trim();
      }
    }

    const phone = message.from?.replace(/\D/g, '') || '';
    if (phone.length >= 10) {
      const formattedPhone = phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      console.log('📞 Usando telefone formatado:', formattedPhone);
      return formattedPhone;
    }

    console.log('⚠️ Nenhum nome válido encontrado, usando padrão');
    return `Contato ${phone || 'Desconhecido'}`;
  }, []);

  // Processar lote de mensagens com assistente automático
  const processBatchWithAssistant = useCallback(async (messages: any[], ticketId: string) => {
    const batchKey = `batch_${ticketId}_${Date.now()}`;
    
    if (processingQueueRef.current.has(batchKey)) {
      console.log('⏭️ Lote já está sendo processado, ignorando:', batchKey);
      return;
    }

    try {
      processingQueueRef.current.add(batchKey);
      console.log(`🤖 Iniciando processamento do lote com ${messages.length} mensagens:`, batchKey);
      
      // Marcar atividade para manter status online
      markActivity();
      
      // Simular que assistente está "digitando"
      setAssistantTyping(true);
      
      // Buscar configurações do cliente
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig) {
        console.log('⚠️ Nenhuma configuração de IA encontrada para cliente:', clientId);
        return;
      }

      // Buscar fila ativa com assistente
      const activeQueue = queues.find((queue: any) => 
        queue.is_active && 
        queue.assistants && 
        queue.assistants.is_active &&
        queue.instance_queue_connections?.some((conn: any) => 
          conn.instance_id && conn.is_active
        )
      );

      if (!activeQueue || !activeQueue.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        return;
      }

      const assistant = activeQueue.assistants;
      console.log('🤖 Processando lote com assistente:', assistant.name);

      // Preparar configurações avançadas
      let advancedSettings = {
        temperature: 0.7,
        max_tokens: 1000,
        response_delay_seconds: 0
      };
      
      try {
        if (assistant.advanced_settings) {
          const parsedSettings = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;
          
          advancedSettings = {
            temperature: Number(parsedSettings.temperature) || 0.7,
            max_tokens: Number(parsedSettings.max_tokens) || 1000,
            response_delay_seconds: Number(parsedSettings.response_delay_seconds) || 0
          };
        }
      } catch (error) {
        console.error('❌ Erro ao parse das configurações avançadas:', error);
      }

      // Buscar histórico de mensagens do ticket
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      const recentMessages = ticketMessages
        .slice(-15)
        .map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content || ''
        }));

      // Processar reações automáticas para cada mensagem
      let emotionContext = '';
      for (const message of messages) {
        const emotion = await processAutoReaction(message);
        if (emotion) {
          emotionContext += `\n${emotion.contextModifier}`;
        }
      }

      // Combinar mensagens do lote em uma única mensagem
      const combinedMessage = messages.map(msg => msg.text).join('\n');
      console.log(`📨 Processando lote combinado: "${combinedMessage.substring(0, 100)}..."`);

      // Modificar prompt baseado na emoção detectada
      let systemPrompt = assistant.prompt || 'Você é um assistente útil.';
      if (emotionContext) {
        systemPrompt += `\n\nContexto emocional da conversa:${emotionContext}`;
      }

      // Chamar a API da OpenAI
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
              content: systemPrompt
            },
            ...recentMessages,
            {
              role: 'user',
              content: combinedMessage
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
        console.log('🤖 Resposta do assistente gerada para lote:', assistantResponse.substring(0, 100) + '...');
        
        // Marcar atividade antes de enviar resposta
        markActivity();
        
        // Enviar resposta com delay humanizado
        await sendWithTypingDelay(assistantResponse, async () => {
          await whatsappService.sendMessage(clientId, messages[0].from, assistantResponse);
          // Marcar atividade após enviar mensagem
          markActivity();
        });
        
        // Registrar a resposta no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from_me: true,
          sender_name: assistant.name,
          content: assistantResponse,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: true,
          ai_confidence_score: data.choices?.[0]?.finish_reason === 'stop' ? 0.9 : 0.7,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta automática do lote enviada e registrada');
        
        // Recarregar tickets com debounce mais rigoroso
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
        loadingTimeoutRef.current = setTimeout(() => {
          if (!isLoadingRef.current) {
            loadTickets(true);
          }
        }, 3000);
        
      } else {
        console.log('⚠️ Assistente não gerou resposta válida para o lote');
      }

    } catch (error) {
      console.error('❌ Erro ao processar lote com assistente:', error);
    } finally {
      processingQueueRef.current.delete(batchKey);
      setAssistantTyping(false);
    }
  }, [clientId, sendWithTypingDelay, loadTickets, markActivity, processAutoReaction]);

  // Hook para processamento em lote (5 segundos de timeout) - com useCallback
  const { addMessage: addToBatch } = useMessageBatch({
    batchTimeoutSeconds: 5,
    onProcessBatch: useCallback(async (messages) => {
      if (messages.length === 0) return;
      
      // Usar ticket ID do primeiro lote de mensagens
      const firstMessage = messages[0];
      const ticketId = `ticket_${firstMessage.from}`;
      
      // Buscar ou criar ticket
      try {
        const existingTickets = tickets.filter(t => t.chat_id === firstMessage.from);
        let targetTicketId = '';
        
        if (existingTickets.length > 0) {
          targetTicketId = existingTickets[0].id;
        } else {
          // Criar novo ticket se não existir
          const customerName = extractWhatsAppName({ from: firstMessage.from });
          const customerPhone = firstMessage.from?.replace(/\D/g, '') || '';
          
          targetTicketId = await ticketsService.createOrUpdateTicket(
            clientId,
            firstMessage.from,
            clientId,
            customerName,
            customerPhone,
            messages.map(m => m.text).join(' '),
            new Date().toISOString()
          );
        }
        
        await processBatchWithAssistant(messages, targetTicketId);
      } catch (error) {
        console.error('❌ Erro ao processar lote de mensagens:', error);
      }
    }, [tickets, clientId, extractWhatsAppName, processBatchWithAssistant])
  });

  // Configurar listeners para atualizações em tempo real - EFEITO ÚNICO
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Configurando listeners de tempo real para cliente:', clientId);
    initializationRef.current = true;

    // Carregar tickets iniciais apenas uma vez
    loadTickets();

    // Conectar ao WebSocket do WhatsApp
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado, entrando no room do cliente...');
      whatsappService.joinClientRoom(clientId);
      // Marcar atividade ao conectar
      markActivity();
    });

    if (socket.connected) {
      whatsappService.joinClientRoom(clientId);
      markActivity();
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
      
      // Marcar atividade ao receber mensagem
      markActivity();
      
      // Controle SUPER rigoroso de duplicação - múltiplas verificações
      const messageKey = `${message.id}_${message.from}_${message.timestamp}_${message.body?.substring(0, 20)}`;
      const shortMessageKey = `${message.id}_${message.from}`;
      
      if (processedMessagesRef.current.has(message.id) || 
          processedMessagesRef.current.has(messageKey) ||
          processedMessagesRef.current.has(shortMessageKey)) {
        console.log('⏭️ Mensagem já processada, ignorando:', message.id);
        return;
      }
      
      // Adicionar aos controles de duplicação
      processedMessagesRef.current.add(message.id);
      processedMessagesRef.current.add(messageKey);
      processedMessagesRef.current.add(shortMessageKey);
      
      // Verificação adicional por lastMessageId
      if (lastMessageIdRef.current === message.id) {
        console.log('⏭️ Mensagem duplicada pelo lastMessageId, ignorando');
        return;
      }
      lastMessageIdRef.current = message.id;
      
      // Ignorar mensagens próprias
      if (message.fromMe) {
        console.log('⏭️ Ignorando mensagem própria');
        return;
      }
      
      try {
        const customerName = extractWhatsAppName(message);
        const customerPhone = message.from?.replace(/\D/g, '') || '';
        
        // Criar/atualizar ticket
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from || message.chatId,
          clientId,
          customerName,
          customerPhone,
          message.body || '',
          new Date().toISOString()
        );

        // Adicionar mensagem ao ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: message.id,
          from_me: message.fromMe || false,
          sender_name: customerName,
          content: message.body || '',
          message_type: message.type || 'text',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'received',
          timestamp: new Date(message.timestamp || Date.now()).toISOString()
        });

        // Recarregar tickets com debounce MUITO rigoroso para evitar loop
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
        loadingTimeoutRef.current = setTimeout(() => {
          if (!isLoadingRef.current) {
            loadTickets(true);
          }
        }, 2000);

        // Adicionar mensagem ao lote para processamento humanizado
        if (!message.type || message.type === 'text' || message.type === 'chat') {
          addToBatch({
            id: message.id,
            text: message.body || '',
            timestamp: message.timestamp || Date.now(),
            from: message.from
          });
        }
        
      } catch (error) {
        console.error('❌ Erro ao processar nova mensagem:', error);
      }
    };

    const messageEvent = `message_${clientId}`;
    socket.on(messageEvent, handleNewWhatsAppMessage);

    // Listener para atualizações de tickets no Supabase com debounce MUITO rigoroso
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
          
          // Debounce SUPER rigoroso para atualizações do Supabase
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }
          loadingTimeoutRef.current = setTimeout(() => {
            if (!isLoadingRef.current) {
              loadTickets(true);
            }
          }, 2000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 Limpando listeners...');
      initializationRef.current = false;
      
      // Limpar timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.off(messageEvent, handleNewWhatsAppMessage);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      processingQueueRef.current.clear();
      processedMessagesRef.current.clear();
    };
  }, [clientId, markActivity]); // Adicionar markActivity como dependência

  // Função pública para recarregar tickets manualmente
  const reloadTickets = useCallback(() => {
    console.log('🔄 Recarregamento manual solicitado');
    loadTickets(true);
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping || isProcessingReaction,
    isOnline,
    reloadTickets
  };
};
