
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { aiConfigService } from '@/services/aiConfigService';
import { useHumanizedTyping } from './useHumanizedTyping';
import { useAutoReactions } from './useAutoReactions';
import { useOnlineStatus } from './useOnlineStatus';
import { useSmartMessageSplit } from './useSmartMessageSplit';
import { useMessageBatch } from './useMessageBatch';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const lastLoadTimeRef = useRef<number>(0);
  const initializationRef = useRef(false);
  const processingRef = useRef<Set<string>>(new Set());
  const conversationContextRef = useRef<Map<string, any[]>>(new Map());

  // Hooks humanizados
  const { simulateHumanTyping, markAsRead } = useHumanizedTyping(clientId);
  const { processMessage: processReaction } = useAutoReactions(clientId, true);
  const { isOnline, markActivity } = useOnlineStatus(clientId, true);
  const { splitMessage, sendMessagesInSequence } = useSmartMessageSplit();

  // Função para normalizar dados da mensagem do WhatsApp
  const normalizeWhatsAppMessage = useCallback((message: any) => {
    console.log('📨 Normalizando mensagem WhatsApp:', {
      id: message.id,
      from: message.from,
      body: message.body?.substring(0, 50),
      fromMe: message.fromMe,
      timestamp: message.timestamp
    });
    
    // Diferentes formatos possíveis de mensagem
    let chatId = message.from || message.chatId || message.key?.remoteJid || message.chat?.id;
    let phoneNumber = chatId;
    
    if (chatId?.includes('@')) {
      phoneNumber = chatId.split('@')[0];
    }
    
    // Extrair nome do contato
    let customerName = message.notifyName || 
                      message.pushName || 
                      message.participant || 
                      message.author ||
                      message.senderName ||
                      phoneNumber;
    
    // Se for grupo, usar nome do grupo
    if (chatId?.includes('@g.us')) {
      customerName = message.chat?.name || customerName;
    }
    
    // Normalizar conteúdo da mensagem
    let content = message.body || 
                  message.caption || 
                  message.text || 
                  message.content ||
                  '';
    
    let messageType = message.type || 'text';
    
    // Processar diferentes tipos de mídia
    if (message.type === 'image' || message.hasMedia) {
      content = `[Imagem] ${message.caption || 'Imagem enviada'}`;
      messageType = 'image';
    } else if (message.type === 'audio' || message.type === 'ptt') {
      content = `[Áudio] Mensagem de áudio`;
      messageType = 'audio';
    } else if (message.type === 'video') {
      content = `[Vídeo] ${message.caption || 'Vídeo enviado'}`;
      messageType = 'video';
    } else if (message.type === 'document') {
      content = `[Documento] ${message.filename || 'Documento enviado'}`;
      messageType = 'document';
    } else if (message.type === 'sticker') {
      content = `[Figurinha] Figurinha enviada`;
      messageType = 'sticker';
    } else if (message.type === 'location') {
      content = `[Localização] Localização compartilhada`;
      messageType = 'location';
    }
    
    // Verificar se é mensagem citada
    if (message.quotedMessage || message.quotedMsg) {
      const quoted = message.quotedMessage || message.quotedMsg;
      const quotedContent = quoted.body || quoted.caption || '[Mídia citada]';
      content = `[Respondendo: "${quotedContent.substring(0, 50)}..."] ${content}`;
    }

    // Validar timestamp
    const timestamp = ticketsService.validateAndFixTimestamp(message.timestamp || message.t || Date.now());

    const normalizedMessage = {
      id: message.id || message.key?.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: chatId,
      fromMe: message.fromMe || false,
      body: content,
      type: messageType,
      timestamp: timestamp,
      author: message.author || customerName,
      notifyName: customerName,
      pushName: customerName,
      mediaUrl: message.mediaUrl || null,
      phoneNumber,
      customerName
    };

    console.log('✅ Mensagem normalizada:', {
      id: normalizedMessage.id,
      from: normalizedMessage.from,
      customerName: normalizedMessage.customerName,
      phoneNumber: normalizedMessage.phoneNumber,
      body: normalizedMessage.body.substring(0, 50),
      fromMe: normalizedMessage.fromMe,
      timestamp: normalizedMessage.timestamp
    });
    
    return normalizedMessage;
  }, []);

  // Carregar tickets com debounce melhorado
  const loadTickets = useCallback(async () => {
    const now = Date.now();
    if (!clientId || !mountedRef.current || (now - lastLoadTimeRef.current) < 1000) {
      return;
    }
    
    try {
      lastLoadTimeRef.current = now;
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
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // Processar mensagem com assistente - COM CONTEXTO MELHORADO
  const processWithAssistant = useCallback(async (message: any, ticketId: string, allMessages: any[] = []) => {
    if (!mountedRef.current || !ticketId) {
      console.log('❌ Componente desmontado ou ticketId inválido, cancelando processamento IA');
      processingRef.current.delete(ticketId);
      return;
    }
    
    console.log(`🤖 INICIANDO PROCESSAMENTO IA - Ticket: ${ticketId}`);
    console.log(`📨 Mensagens para processar: ${allMessages.length}`);
    console.log(`📝 Conteúdo das mensagens:`, allMessages.map(m => ({
      id: m.id,
      content: m.body?.substring(0, 100),
      fromMe: m.fromMe
    })));
    
    try {
      setAssistantTyping(true);
      console.log('🤖 Assistente iniciou digitação');
      
      // Buscar configurações necessárias
      console.log('🔍 Buscando configurações de IA e filas...');
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      console.log('🔍 Configurações encontradas:', {
        queuesCount: queues.length,
        hasAiConfig: !!aiConfig,
        hasOpenAiKey: !!aiConfig?.openai_api_key
      });

      if (!aiConfig?.openai_api_key) {
        console.log('⚠️ Configuração de IA não encontrada - chave OpenAI ausente');
        return;
      }

      // Encontrar fila ativa com assistente
      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        console.log('🔍 Filas disponíveis:', queues.map(q => ({
          id: q.id,
          name: q.name,
          isActive: q.is_active,
          hasAssistant: !!q.assistants,
          assistantActive: q.assistants?.is_active
        })));
        return;
      }

      const assistant = activeQueue.assistants;
      console.log(`🤖 Usando assistente: ${assistant.name} na fila: ${activeQueue.name}`);

      // Buscar instância WhatsApp ativa
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId)
        .eq('status', 'connected')
        .limit(1);

      if (!instances || instances.length === 0) {
        console.log('⚠️ Nenhuma instância WhatsApp conectada');
        return;
      }

      const instanceId = instances[0].instance_id;
      console.log(`📱 Usando instância WhatsApp: ${instanceId}`);

      // Atualizar ticket com informações da fila
      await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: activeQueue.id,
          assigned_assistant_id: assistant.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      // Buscar contexto completo do banco sempre
      console.log('📚 Buscando contexto completo do banco de dados...');
      const ticketMessages = await ticketsService.getTicketMessages(ticketId, 100);
      const contextMessages = ticketMessages.map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.content,
        timestamp: msg.timestamp,
        messageId: msg.message_id
      }));
      
      console.log(`📚 Contexto do banco carregado: ${contextMessages.length} mensagens`);
      
      // Atualizar contexto local
      conversationContextRef.current.set(ticketId, contextMessages);

      // Preparar configurações
      let settings = { temperature: 0.7, max_tokens: 1000 };
      try {
        if (assistant.advanced_settings) {
          const parsed = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;
          settings = {
            temperature: parsed.temperature || 0.7,
            max_tokens: parsed.max_tokens || 1000
          };
        }
      } catch (e) {
        console.error('Erro ao parse das configurações:', e);
      }

      // Preparar o contexto das mensagens atuais
      const currentBatchContent = allMessages
        .filter(msg => !msg.fromMe) // Apenas mensagens do cliente
        .map(msg => msg.body || msg.caption || '[Mídia]')
        .join('\n');
      
      console.log('📝 Contexto atual para IA:', {
        totalContext: contextMessages.length,
        currentBatch: currentBatchContent.substring(0, 100),
        clientMessagesInBatch: allMessages.filter(msg => !msg.fromMe).length
      });

      // Se não há mensagens novas do cliente, não processar
      if (!currentBatchContent.trim()) {
        console.log('⚠️ Nenhuma mensagem nova do cliente para processar');
        return;
      }

      // Criar mensagens para OpenAI - MELHORAR PROMPT DO SISTEMA
      const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nContexto importante: 
- Você está respondendo mensagens do WhatsApp em uma conversa em tempo real
- O cliente enviou novas mensagens que você deve considerar
- Você tem acesso ao histórico completo de ${contextMessages.length} mensagens desta conversa
- ANALISE todo o contexto para dar uma resposta coerente e natural
- NÃO repita informações já dadas anteriormente na conversa
- Mantenha a conversa fluida e natural, respondendo especificamente às novas mensagens
- Responda de forma específica ao que o cliente perguntou ou comentou
- Seja conciso mas completo
- Use um tom natural e conversacional`;

      // Usar as últimas 100 mensagens do contexto + as mensagens atuais
      const recentContext = contextMessages.slice(-100).filter(msg => msg.content && msg.content.trim());
      
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...recentContext,
        {
          role: 'user',
          content: `NOVAS MENSAGENS DO CLIENTE: ${currentBatchContent}`
        }
      ];

      console.log('🚀 Chamando OpenAI com contexto estruturado:', {
        systemPrompt: systemPrompt.substring(0, 100),
        recentContextMessages: recentContext.length,
        totalMessages: messages.length,
        newContent: currentBatchContent.substring(0, 100)
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || 'gpt-4o-mini',
          messages: messages,
          temperature: settings.temperature,
          max_tokens: settings.max_tokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro da OpenAI:', response.status, errorText);
        throw new Error(`Erro da OpenAI: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 Resposta recebida (${assistantResponse.length} caracteres):`, assistantResponse.substring(0, 200));
        
        // Quebrar resposta em blocos menores
        const messageBlocks = splitMessage(assistantResponse);
        console.log(`📝 Resposta dividida em ${messageBlocks.length} blocos`);
        
        // Simular digitação apenas uma vez antes do primeiro bloco
        await simulateHumanTyping(message.from, assistantResponse);
        
        // Enviar blocos em sequência
        for (let i = 0; i < messageBlocks.length; i++) {
          if (!mountedRef.current) break;
          
          const blockContent = messageBlocks[i];
          console.log(`📤 Enviando bloco ${i + 1}/${messageBlocks.length}: ${blockContent.substring(0, 100)}`);
          
          // Delay entre blocos
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // Enviar via WhatsApp
          const sendResult = await whatsappService.sendMessage(instanceId, message.from, blockContent);
          console.log(`📤 Resultado do envio bloco ${i + 1}:`, sendResult);
          
          // Registrar no ticket
          const aiMessageId = `ai_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
          await ticketsService.addTicketMessage({
            ticket_id: ticketId,
            message_id: aiMessageId,
            from_me: true,
            sender_name: `🤖 ${assistant.name}`,
            content: blockContent,
            message_type: 'text',
            is_internal_note: false,
            is_ai_response: true,
            ai_confidence_score: 0.9,
            processing_status: 'completed',
            timestamp: new Date().toISOString()
          });
        }

        console.log('✅ Resposta completa enviada');
        
        // Marcar mensagens como lidas após enviar toda a resposta
        for (const msg of allMessages.filter(m => !m.fromMe)) {
          await markAsRead(message.from, msg.id || msg.key?.id);
        }
      } else {
        console.log('⚠️ Resposta do assistente vazia ou inválida:', assistantResponse);
      }

    } catch (error) {
      console.error('❌ Erro no processamento do assistente:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
        console.log('🤖 Assistente parou de digitar');
      }
      processingRef.current.delete(ticketId);
      console.log('✅ Processamento finalizado para ticket:', ticketId);
    }
  }, [clientId, simulateHumanTyping, markAsRead, splitMessage]);

  // Hook para agrupamento de mensagens
  const { addMessage, getBatchInfo, markBatchAsCompleted, updateCallback } = useMessageBatch(async (chatId: string, messages: any[]) => {
    console.log(`📦 PROCESSBATCH CHAMADO - chatId: ${chatId}, mensagens: ${messages.length}`);
    
    if (!mountedRef.current || messages.length === 0) {
      console.log('❌ Componente desmontado ou lote vazio, cancelando processamento');
      return;
    }

    console.log(`📦 INICIANDO processamento de lote de ${messages.length} mensagens do chat ${chatId}`);
    console.log(`📝 Mensagens do lote:`, messages.map(m => ({
      id: m.id,
      content: m.body?.substring(0, 50),
      fromMe: m.fromMe,
      timestamp: new Date(m.timestamp || Date.now()).toLocaleTimeString()
    })));
    
    const clientMessages = messages.filter(msg => !msg.fromMe);
    if (clientMessages.length === 0) {
      console.log('📤 Todas as mensagens são nossas, apenas salvando...');
      
      for (const message of messages) {
        if (message.fromMe) {
          try {
            const normalizedMessage = normalizeWhatsAppMessage(message);
            const ticketsData = await ticketsService.getClientTickets(clientId);
            const existingTicket = ticketsData.find(t => t.chat_id === normalizedMessage.from);
            
            if (existingTicket) {
              await ticketsService.addTicketMessage({
                ticket_id: existingTicket.id,
                message_id: normalizedMessage.id,
                from_me: true,
                sender_name: 'Atendente',
                content: normalizedMessage.body,
                message_type: normalizedMessage.type,
                is_internal_note: false,
                is_ai_response: false,
                processing_status: 'completed',
                timestamp: normalizedMessage.timestamp,
                media_url: normalizedMessage.mediaUrl
              });
            }
          } catch (error) {
            console.error('❌ Erro ao salvar mensagem enviada:', error);
          }
        }
      }
      
      markBatchAsCompleted(chatId);
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);
      
      return;
    }
    
    const firstClientMessage = clientMessages[0];
    const normalizedMessage = normalizeWhatsAppMessage(firstClientMessage);
    
    try {
      console.log('👤 Criando/atualizando ticket para:', normalizedMessage.customerName);
      
      const ticketId = await ticketsService.createOrUpdateTicket(
        clientId,
        normalizedMessage.from,
        clientId,
        normalizedMessage.customerName,
        normalizedMessage.phoneNumber,
        normalizedMessage.body,
        normalizedMessage.timestamp
      );

      console.log('📋 Ticket processado:', ticketId);

      // Salvar todas as mensagens
      for (const message of messages) {
        const normalized = normalizeWhatsAppMessage(message);
        
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: normalized.id,
          from_me: normalized.fromMe,
          sender_name: normalized.author,
          content: normalized.body,
          message_type: normalized.type,
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'received',
          timestamp: normalized.timestamp,
          media_url: normalized.mediaUrl
        });
      }

      // Processar reações para mensagens do cliente
      for (const message of clientMessages) {
        const normalized = normalizeWhatsAppMessage(message);
        await processReaction(normalized);
      }

      markActivity();

      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);

      // Processar com assistente apenas se não estiver já processando
      if (!processingRef.current.has(ticketId)) {
        processingRef.current.add(ticketId);
        console.log(`🤖 INICIANDO processamento com assistente para ticket: ${ticketId}`);
        setTimeout(() => {
          if (mountedRef.current) {
            processWithAssistant(normalizedMessage, ticketId, clientMessages);
          }
        }, 1000);
      } else {
        console.log(`⚠️ Ticket ${ticketId} já está sendo processado pelo assistente, aguardando`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar lote de mensagens:', error);
    }
  });

  // Configurar listeners uma única vez
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Inicializando listeners para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    loadTickets();

    let socket: any = null;
    try {
      socket = whatsappService.connectSocket();
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ WebSocket conectado para cliente:', clientId);
        whatsappService.joinClientRoom(clientId);
      });

      socket.on('disconnect', (reason: any) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      socket.on('connect_error', (error: any) => {
        console.error('❌ Erro de conexão WebSocket:', error);
      });

      const events = [
        `message_${clientId}`,
        `new_message_${clientId}`,
        `whatsapp_message_${clientId}`,
        `message`,
        `message_${clientId}_instance_1750600195961`
      ];

      events.forEach(eventName => {
        socket.on(eventName, async (message: any) => {
          if (!mountedRef.current) return;
          
          console.log(`📨 Evento ${eventName} recebido:`, {
            id: message.id,
            from: message.from,
            body: message.body?.substring(0, 50),
            fromMe: message.fromMe
          });
          
          addMessage(message);
        });
      });

      const channel = supabase
        .channel(`tickets-${clientId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_tickets',
            filter: `client_id=eq.${clientId}`
          },
          (payload) => {
            console.log('🔄 Mudança no banco detectada:', payload);
            if (mountedRef.current) {
              setTimeout(loadTickets, 1000);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

    } catch (error) {
      console.error('❌ Erro ao inicializar conexões:', error);
    }

    return () => {
      console.log('🔌 Limpando recursos...');
      mountedRef.current = false;
      initializationRef.current = false;
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      processedMessagesRef.current.clear();
      processingRef.current.clear();
      conversationContextRef.current.clear();
    };
  }, [clientId, loadTickets, addMessage]);

  const reloadTickets = useCallback(() => {
    if (mountedRef.current) {
      loadTickets();
    }
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline,
    reloadTickets,
    getBatchInfo
  };
};
