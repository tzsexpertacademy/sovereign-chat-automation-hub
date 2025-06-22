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

  // Hook para agrupamento de mensagens
  const { addMessage, getBatchInfo, markBatchAsCompleted, updateCallback } = useMessageBatch(async (chatId: string, messages: any[]) => {
    console.log(`📦 PROCESSBATCH CHAMADO - chatId: ${chatId}, mensagens: ${messages.length}`);
    
    if (!mountedRef.current || messages.length === 0) {
      console.log('❌ Componente desmontado ou lote vazio, cancelando processamento');
      return;
    }

    console.log(`📦 INICIANDO processamento de lote de ${messages.length} mensagens do chat ${chatId}:`);
    messages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.body?.substring(0, 50) || '[mídia]'} (${msg.fromMe ? 'nossa' : 'cliente'})`);
    });
    
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
      console.log('👤 Criando/atualizando ticket para:', {
        clientId,
        chatId: normalizedMessage.from,
        customerName: normalizedMessage.customerName,
        phoneNumber: normalizedMessage.phoneNumber,
        totalMessages: messages.length,
        clientMessages: clientMessages.length
      });
      
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

      // Atualizar contexto da conversa ANTES de salvar as mensagens
      const existingContext = conversationContextRef.current.get(ticketId) || [];
      
      for (const message of messages) {
        const normalized = normalizeWhatsAppMessage(message);
        
        console.log('💾 Salvando mensagem no ticket:', {
          ticketId,
          messageId: normalized.id,
          fromMe: normalized.fromMe,
          content: normalized.body.substring(0, 50)
        });
        
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

        // Adicionar ao contexto local
        existingContext.push({
          role: normalized.fromMe ? 'assistant' : 'user',
          content: normalized.body,
          timestamp: normalized.timestamp,
          messageId: normalized.id
        });
      }

      // Manter apenas as últimas 100 mensagens no contexto
      if (existingContext.length > 100) {
        existingContext.splice(0, existingContext.length - 100);
      }
      
      conversationContextRef.current.set(ticketId, existingContext);
      console.log(`📝 Contexto da conversa atualizado: ${existingContext.length} mensagens`);

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

      if (!processingRef.current.has(ticketId)) {
        processingRef.current.add(ticketId);
        console.log(`🤖 INICIANDO processamento com assistente para ${clientMessages.length} mensagens do cliente`);
        setTimeout(() => {
          if (mountedRef.current) {
            processWithAssistant(normalizedMessage, ticketId, clientMessages);
          }
        }, 1000);
      } else {
        console.log(`⚠️ Ticket ${ticketId} já está sendo processado pelo assistente, ignorando`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar lote de mensagens:', error);
    }
  });

  // Processar mensagem com assistente - COM CONTEXTO MELHORADO
  const processWithAssistant = useCallback(async (message: any, ticketId: string, allMessages: any[] = []) => {
    if (!mountedRef.current || !ticketId) {
      console.log('❌ Componente desmontado ou ticketId inválido, cancelando processamento IA');
      processingRef.current.delete(ticketId);
      return;
    }
    
    // Verificar duplicação por ID da mensagem e contexto
    const conversationContext = conversationContextRef.current.get(ticketId) || [];
    const lastUserMessages = allMessages.map(m => m.body).join(' | ');
    const contextKey = `${ticketId}_${lastUserMessages}`;
    
    if (processedMessagesRef.current.has(contextKey)) {
      console.log('⚠️ Contexto já processado pelo assistente, ignorando:', contextKey);
      processingRef.current.delete(ticketId);
      return;
    }
    
    console.log(`🤖 PROCESSAMENTO IA - Lote de ${allMessages.length} mensagens com contexto de ${conversationContext.length} mensagens`);
    processedMessagesRef.current.add(contextKey);
    
    try {
      setAssistantTyping(true);
      console.log('🤖 Assistente iniciou digitação');
      
      // Buscar configurações necessárias
      console.log('🔍 Buscando configurações de IA e filas...');
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('⚠️ Configuração de IA não encontrada - chave OpenAI ausente');
        return;
      }

      // Encontrar fila ativa com assistente
      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
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

      // Usar contexto local se disponível, senão buscar do banco
      let contextMessages = conversationContext;
      if (contextMessages.length === 0) {
        console.log('📚 Buscando contexto completo do banco de dados...');
        const ticketMessages = await ticketsService.getTicketMessages(ticketId, 100);
        contextMessages = ticketMessages.map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content,
          timestamp: msg.timestamp,
          messageId: msg.message_id
        }));
        
        // Atualizar contexto local
        conversationContextRef.current.set(ticketId, contextMessages);
      }

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
      const currentBatchContent = allMessages.map(msg => msg.body || msg.caption || '[Mídia]').join('\n');
      
      console.log('📝 Contexto atual para IA:', {
        totalContext: contextMessages.length,
        currentBatch: currentBatchContent.substring(0, 100)
      });

      // Criar mensagens para OpenAI - ordem cronológica CORRETA
      const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nContexto importante: 
- Você está respondendo mensagens do WhatsApp em uma conversa contínua
- O cliente enviou ${allMessages.length} mensagens em sequência que você deve responder
- Você tem acesso ao histórico completo de ${contextMessages.length} mensagens desta conversa
- IMPORTANTE: Analise toda a conversa anterior para dar continuidade natural, NÃO repita respostas
- Se o cliente fez uma pergunta específica na sequência atual, responda especificamente a ela
- Mantenha a continuidade e coerência com as interações passadas
- Se o cliente fizer referência a algo mencionado anteriormente, demonstre que você lembra
- Seja conciso mas completo em suas respostas
- NUNCA repita a mesma resposta que já foi enviada anteriormente`;

      // Usar as últimas 50 mensagens do contexto + as mensagens atuais
      const recentContext = contextMessages.slice(-50);
      
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...recentContext.filter(msg => msg.content && msg.content.trim()),
        {
          role: 'user',
          content: `NOVA SEQUÊNCIA DE MENSAGENS:\n${currentBatchContent}`
        }
      ];

      console.log('🚀 Chamando OpenAI com contexto estruturado:', {
        systemPrompt: systemPrompt.substring(0, 100),
        contextMessages: recentContext.length,
        totalMessages: messages.length
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
        throw new Error(`Erro da OpenAI: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 Resposta original recebida (${assistantResponse.length} caracteres):`, assistantResponse.substring(0, 100));
        
        // Quebrar resposta em blocos menores usando o hook inteligente
        const messageBlocks = splitMessage(assistantResponse);
        console.log(`📝 Resposta dividida em ${messageBlocks.length} blocos:`, 
          messageBlocks.map((block, index) => `${index + 1}: ${block.substring(0, 30)}...`));
        
        // Simular digitação APENAS UMA VEZ antes de começar a enviar
        await simulateHumanTyping(message.from, assistantResponse);
        
        // Enviar blocos em sequência com delay natural entre eles
        for (let i = 0; i < messageBlocks.length; i++) {
          if (!mountedRef.current) break;
          
          const blockContent = messageBlocks[i];
          console.log(`📤 Enviando bloco ${i + 1}/${messageBlocks.length}: ${blockContent.substring(0, 50)}...`);
          
          // Delay natural entre blocos (exceto o primeiro)
          if (i > 0) {
            const naturalDelay = Math.min(blockContent.length * 30, 2000);
            await new Promise(resolve => setTimeout(resolve, naturalDelay));
          }
          
          // Enviar via WhatsApp
          await whatsappService.sendMessage(instanceId, message.from, blockContent);
          
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

          // Atualizar contexto local com a resposta
          const currentContext = conversationContextRef.current.get(ticketId) || [];
          currentContext.push({
            role: 'assistant',
            content: blockContent,
            timestamp: new Date().toISOString(),
            messageId: aiMessageId
          });
          
          // Manter apenas as últimas 100 mensagens
          if (currentContext.length > 100) {
            currentContext.splice(0, currentContext.length - 100);
          }
          
          conversationContextRef.current.set(ticketId, currentContext);
        }

        console.log('✅ Todos os blocos da resposta foram enviados com sucesso');
        
        // Marcar mensagens como lidas APÓS envio completo
        for (const msg of allMessages) {
          await markAsRead(message.from, msg.id || msg.key?.id);
        }
      } else {
        console.log('⚠️ Resposta do assistente vazia ou inválida');
      }

    } catch (error) {
      console.error('❌ Erro no processamento do assistente:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
        console.log('🤖 Assistente parou de digitar');
      }
      processingRef.current.delete(ticketId);
      markBatchAsCompleted(message.from);
      console.log('✅ Processamento do assistente finalizado');
    }
  }, [clientId, simulateHumanTyping, markAsRead, markBatchAsCompleted, splitMessage]);

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
            type: message.type,
            body: message.body?.substring(0, 50),
            fromMe: message.fromMe
          });
          
          console.log('📦 CHAMANDO addMessage para:', message.id);
          addMessage(message);
        });
      });

      socket.onAny((eventName: string, ...args: any[]) => {
        if (eventName.includes(clientId) || eventName.includes('message')) {
          console.log(`🔔 Evento WebSocket: ${eventName}`, args);
        }
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
            console.log('🔄 Mudança no banco de dados detectada:', payload);
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
