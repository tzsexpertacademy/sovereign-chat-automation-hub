import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { aiConfigService } from '@/services/aiConfigService';
import { useMessageBatch } from './useMessageBatch';
import { useHumanizedResponse } from './useHumanizedResponse';
import { useConversationStatus } from './useConversationStatus';
import { useMessageReactions } from './useMessageReactions';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const lastMessageIdRef = useRef<string>('');
  const socketRef = useRef<any>(null);
  const processingQueueRef = useRef<Set<string>>(new Set());
  const onlineStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Hook para humanização de respostas
  const { sendHumanizedResponse, maintainOnlineStatus } = useHumanizedResponse({ clientId });

  // Hook para status de conversação
  const { shouldPauseAssistant, markClientResponding, markClientStoppedResponding } = useConversationStatus(clientId);

  // Hook para reações automáticas
  const { processMessageForReaction, generateReactionPrompt } = useMessageReactions(clientId);

  // Função para carregar tickets iniciais
  const loadTickets = async () => {
    if (isLoadingRef.current || !clientId) return;
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      console.log('🔄 Carregando tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets carregados:', ticketsData.length);
      
      setTickets(ticketsData);
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Função para extrair nome real do WhatsApp
  const extractWhatsAppName = (message: any) => {
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
  };

  // Função para processar lote de mensagens (atualizada com verificação de pausa)
  const processBatchedMessages = async (messages: any[], chatId: string) => {
    if (messages.length === 0) return;
    
    // Verificar se assistente deve pausar para este chat
    if (shouldPauseAssistant(chatId)) {
      console.log('⏸️ Assistente pausado - cliente está respondendo:', chatId);
      return;
    }
    
    console.log(`🎯 Processando lote de ${messages.length} mensagens para ${chatId}`);
    
    try {
      // Buscar o ticket correspondente
      const ticket = tickets.find(t => t.chat_id === chatId);
      if (!ticket) {
        console.error('❌ Ticket não encontrado para chat:', chatId);
        return;
      }

      // Combinar todas as mensagens do lote em contexto
      const combinedText = messages.map(msg => msg.text).join(' ');
      console.log(`📝 Texto combinado: ${combinedText.substring(0, 100)}...`);

      // Processar reação se apropriada
      const lastMessage = messages[messages.length - 1];
      await processMessageForReaction(chatId, lastMessage.id, combinedText);

      // Processar com o assistente usando o contexto completo
      await processMessageWithAssistant({
        id: messages[messages.length - 1].id,
        body: combinedText,
        from: chatId,
        timestamp: Date.now(),
        type: 'text'
      }, ticket.id);

    } catch (error) {
      console.error('❌ Erro ao processar lote de mensagens:', error);
    }
  };

  // Hook de agrupamento de mensagens (5 segundos)
  const { addMessage: addToBatch } = useMessageBatch({
    batchTimeoutSeconds: 5,
    onProcessBatch: processBatchedMessages
  });

  // Processar mensagem com assistente automático (atualizada com sistema de reações)
  const processMessageWithAssistant = async (message: any, ticketId: string) => {
    const messageKey = `${message.id}_${ticketId}`;
    
    // Evitar processamento duplicado
    if (processingQueueRef.current.has(messageKey)) {
      console.log('⏭️ Mensagem já está sendo processada, ignorando:', messageKey);
      return;
    }

    // Verificar se assistente deve pausar
    if (shouldPauseAssistant(message.from)) {
      console.log('⏸️ Assistente pausado - cliente está respondendo:', message.from);
      return;
    }

    try {
      processingQueueRef.current.add(messageKey);
      console.log('🤖 Iniciando processamento automático da mensagem:', message.id);
      
      // Buscar configurações do cliente com timeout
      const configPromise = Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar configurações')), 10000)
      );

      const [queues, aiConfig] = await Promise.race([configPromise, timeoutPromise]) as any;

      if (!aiConfig) {
        console.log('⚠️ Nenhuma configuração de IA encontrada para cliente:', clientId);
        return;
      }

      console.log('🔍 Configuração IA encontrada:', aiConfig.default_model);

      // Buscar fila ativa conectada à instância
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
      console.log('🤖 Processando com assistente:', assistant.name, 'Modelo:', assistant.model);

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

      // Buscar histórico de mensagens do ticket para contexto
      console.log('📚 Buscando histórico de mensagens para contexto...');
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      console.log(`📨 ${ticketMessages.length} mensagens encontradas no histórico`);
      
      const recentMessages = ticketMessages
        .slice(-15) // Usar menos mensagens para melhor performance
        .map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content || ''
        }));

      // Gerar prompt adicional baseado em reações
      const reactionPrompt = generateReactionPrompt(message.body || '');

      console.log(`🔄 Enviando para OpenAI com ${recentMessages.length} mensagens de contexto`);

      // Chamar a API da OpenAI com timeout
      const openaiPromise = fetch('https://api.openai.com/v1/chat/completions', {
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
              content: (assistant.prompt || 'Você é um assistente útil.') + reactionPrompt
            },
            ...recentMessages,
            {
              role: 'user',
              content: message.body || ''
            }
          ],
          temperature: advancedSettings.temperature,
          max_tokens: advancedSettings.max_tokens,
        }),
      });

      const apiTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na API da OpenAI')), 30000)
      );

      const response = await Promise.race([openaiPromise, apiTimeoutPromise]) as Response;

      console.log('📡 Resposta da OpenAI:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse && assistantResponse.trim()) {
        console.log('🤖 Resposta do assistente gerada:', assistantResponse.substring(0, 100) + '...');
        
        // 🚀 USAR RESPOSTA HUMANIZADA AQUI
        await sendHumanizedResponse(message.from, assistantResponse, assistant.name);
        
        // Registrar a resposta no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from_me: true,
          sender_name: assistant.name,
          content: assistantResponse,
          message_type: assistantResponse.toLowerCase().includes('audio:') ? 'audio' : 'text',
          is_internal_note: false,
          is_ai_response: true,
          ai_confidence_score: data.choices?.[0]?.finish_reason === 'stop' ? 0.9 : 0.7,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta humanizada enviada e registrada');
        
        // Recarregar tickets para mostrar a nova mensagem
        setTimeout(() => {
          if (!isLoadingRef.current) {
            loadTickets();
          }
        }, 1000);
        
      } else {
        console.log('⚠️ Assistente não gerou resposta válida');
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem com assistente:', error);
    } finally {
      // Remover da fila de processamento
      processingQueueRef.current.delete(messageKey);
    }
  };

  // Configurar listeners para atualizações em tempo real
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 Configurando listeners de tempo real para cliente:', clientId);

    // Carregar tickets iniciais apenas uma vez
    loadTickets();

    // 🟢 Manter status online a cada 30 segundos
    onlineStatusIntervalRef.current = setInterval(() => {
      maintainOnlineStatus();
    }, 30000);

    // Manter online imediatamente
    maintainOnlineStatus();

    // Conectar ao WebSocket do WhatsApp
    console.log('🔌 Conectando ao WebSocket...');
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    // Garantir que entramos no room do cliente
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado, entrando no room do cliente...');
      whatsappService.joinClientRoom(clientId);
    });

    // Se já estiver conectado, entrar no room imediatamente
    if (socket.connected) {
      whatsappService.joinClientRoom(clientId);
    }

    // Listener para detectar quando cliente está digitando/respondendo
    whatsappService.onClientTyping(clientId, (data) => {
      console.log('⌨️ Cliente digitando detectado:', data);
      if (data.isTyping) {
        markClientResponding(data.chatId);
      } else {
        markClientStoppedResponding(data.chatId);
      }
    });

    // Listener para novas mensagens do WhatsApp via WebSocket
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida via WebSocket:', {
        id: message.id,
        from: message.from,
        body: message.body?.substring(0, 50),
        fromMe: message.fromMe,
        timestamp: message.timestamp,
        type: message.type || 'text'
      });
      
      // Evitar processar a mesma mensagem duas vezes
      if (lastMessageIdRef.current === message.id) {
        console.log('⏭️ Mensagem já processada, ignorando');
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
        
        console.log('👤 Dados do cliente:', { customerName, customerPhone });
        
        // Criar/atualizar ticket imediatamente
        console.log('🎯 Criando/atualizando ticket...');
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from || message.chatId,
          clientId,
          customerName,
          customerPhone,
          message.body || '',
          new Date().toISOString()
        );

        console.log('✅ Ticket criado/atualizado:', ticketId);

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

        console.log('📝 Mensagem adicionada ao ticket');

        // Atualizar lista de tickets IMEDIATAMENTE
        console.log('🔄 Recarregando tickets...');
        await loadTickets();

        // 🎯 ADICIONAR AO LOTE PARA PROCESSAMENTO AGRUPADO
        if (!message.type || message.type === 'text' || message.type === 'chat') {
          console.log('📦 Adicionando mensagem ao lote para processamento...');
          addToBatch({
            id: message.id,
            text: message.body || '',
            timestamp: message.timestamp || Date.now(),
            from: message.from,
            chatId: message.from || message.chatId
          });
        } else {
          console.log('⏭️ Tipo de mensagem não suportado para processamento automático:', message.type);
        }
        
      } catch (error) {
        console.error('❌ Erro ao processar nova mensagem:', error);
      }
    };

    // Conectar listener para mensagens específicas do cliente
    const messageEvent = `message_${clientId}`;
    socket.on(messageEvent, handleNewWhatsAppMessage);
    console.log(`🎧 Listener configurado para evento: ${messageEvent}`);

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
          // Recarregar tickets após mudanças
          setTimeout(() => {
            if (!isLoadingRef.current) {
              loadTickets();
            }
          }, 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages'
        },
        async (payload) => {
          console.log('💬 Nova mensagem de ticket via Supabase');
          // Atualizar tickets para mostrar nova mensagem
          setTimeout(() => {
            if (!isLoadingRef.current) {
              loadTickets();
            }
          }, 500);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 Limpando listeners...');
      
      // Limpar intervalo de status online
      if (onlineStatusIntervalRef.current) {
        clearInterval(onlineStatusIntervalRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.off(messageEvent, handleNewWhatsAppMessage);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      // Limpar fila de processamento
      processingQueueRef.current.clear();
    };
  }, [clientId, addToBatch, sendHumanizedResponse, maintainOnlineStatus, shouldPauseAssistant]);

  return {
    tickets,
    isLoading,
    reloadTickets: loadTickets
  };
};
