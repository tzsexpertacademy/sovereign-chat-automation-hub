
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
import { useMessageStatus } from './useMessageStatus';

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

  // Hooks humanizados
  const { simulateHumanTyping, markAsRead, isTyping, isRecording } = useHumanizedTyping(clientId);
  const { processMessage: processReaction } = useAutoReactions(clientId, true);
  const { isOnline, markActivity } = useOnlineStatus(clientId, true);
  const { splitMessage } = useSmartMessageSplit();
  const { simulateMessageProgression } = useMessageStatus();

  // Função para normalizar dados da mensagem do WhatsApp
  const normalizeWhatsAppMessage = useCallback((message: any) => {
    let chatId = message.from || message.chatId || message.key?.remoteJid || message.chat?.id;
    let phoneNumber = chatId;
    
    if (chatId?.includes('@')) {
      phoneNumber = chatId.split('@')[0];
    }
    
    let customerName = message.notifyName || 
                      message.pushName || 
                      message.participant || 
                      message.author ||
                      message.senderName ||
                      phoneNumber;
    
    if (chatId?.includes('@g.us')) {
      customerName = message.chat?.name || customerName;
    }
    
    let content = message.body || 
                  message.caption || 
                  message.text || 
                  message.content ||
                  '';
    
    let messageType = message.type || 'text';
    
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
    
    if (message.quotedMessage || message.quotedMsg) {
      const quoted = message.quotedMessage || message.quotedMsg;
      const quotedContent = quoted.body || quoted.caption || '[Mídia citada]';
      content = `[Respondendo: "${quotedContent.substring(0, 50)}..."] ${content}`;
    }

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
    
    return normalizedMessage;
  }, []);

  // Carregar tickets
  const loadTickets = useCallback(async () => {
    const now = Date.now();
    if (!clientId || !mountedRef.current || (now - lastLoadTimeRef.current) < 1000) {
      return;
    }
    
    try {
      lastLoadTimeRef.current = now;
      setIsLoading(true);
      console.log('🔄 CARREGANDO tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ TICKETS carregados:', ticketsData.length);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error('❌ ERRO ao carregar tickets:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // PROCESSAMENTO COM ASSISTENTE - ANTI-DUPLICAÇÃO
  const processWithAssistant = useCallback(async (message: any, ticketId: string, allMessages: any[] = []) => {
    // VERIFICAÇÃO CRÍTICA ANTI-DUPLICAÇÃO
    const processingKey = `${ticketId}_${Date.now()}`;
    
    if (!mountedRef.current || !ticketId || processingRef.current.has(ticketId)) {
      console.log(`❌ BLOQUEANDO processamento duplicado para ticket: ${ticketId}`);
      return;
    }
    
    processingRef.current.add(ticketId);
    console.log(`🤖 ===== INICIANDO PROCESSAMENTO IA (${processingKey}) =====`);
    
    try {
      setAssistantTyping(true);
      markActivity();
      
      // BUSCAR CONFIGURAÇÕES
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('❌ SEM configuração de IA - PARANDO');
        return;
      }

      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('❌ NENHUMA fila ativa com assistente');
        return;
      }

      const assistant = activeQueue.assistants;

      // INSTÂNCIA WHATSAPP
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId)
        .eq('status', 'connected')
        .limit(1);

      if (!instances || instances.length === 0) {
        console.log('❌ NENHUMA instância conectada');
        return;
      }

      const instanceId = instances[0].instance_id;

      // ATUALIZAR TICKET
      await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: activeQueue.id,
          assigned_assistant_id: assistant.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      // CONTEXTO
      const ticketMessages = await ticketsService.getTicketMessages(ticketId, 50);
      
      // CONFIGURAÇÕES
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
        console.error('ERRO ao parse das configurações:', e);
      }

      // MENSAGENS ATUAIS
      const currentBatchContent = allMessages
        .filter(msg => !msg.fromMe)
        .map(msg => msg.body || msg.caption || '[Mídia]')
        .join('\n');

      if (!currentBatchContent.trim()) {
        console.log('⚠️ NENHUMA mensagem nova do cliente');
        return;
      }

      // CONTEXTO PARA IA
      const contextMessages = ticketMessages.map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.content
      }));

      const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nVocê está respondendo mensagens do WhatsApp. Responda de forma específica às novas mensagens do cliente considerando o contexto da conversa.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...contextMessages.slice(-10),
        { role: 'user', content: `NOVA MENSAGEM: ${currentBatchContent}` }
      ];

      console.log(`🚀 ENVIANDO para OpenAI`);

      // CHAMAR OPENAI
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
        console.error('❌ ERRO da OpenAI:', response.status, errorText);
        throw new Error(`Erro da OpenAI: ${response.status}`);
      }

      const responseData = await response.json();
      const assistantResponse = responseData.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 RESPOSTA recebida (${assistantResponse.length} chars)`);
        
        // SIMULAR DIGITAÇÃO
        try {
          await simulateHumanTyping(message.from, assistantResponse);
        } catch (typingError) {
          console.warn('⚠️ ERRO na simulação de digitação:', typingError);
        }
        
        // QUEBRAR EM BLOCOS
        const messageBlocks = splitMessage(assistantResponse);
        console.log(`📝 RESPOSTA dividida em ${messageBlocks.length} blocos`);
        
        // ENVIAR CADA BLOCO COM CONTROLE ANTI-DUPLICAÇÃO
        for (let i = 0; i < messageBlocks.length; i++) {
          if (!mountedRef.current || !processingRef.current.has(ticketId)) {
            console.log('❌ INTERROMPENDO envio - componente desmontado ou processamento cancelado');
            break;
          }
          
          const blockContent = messageBlocks[i];
          console.log(`📤 ENVIANDO bloco ${i + 1}/${messageBlocks.length}`);
          
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          try {
            // GERAR ID ÚNICO PARA CADA BLOCO
            const aiMessageId = `ai_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
            
            // VERIFICAR SE JÁ FOI PROCESSADO
            if (processedMessagesRef.current.has(aiMessageId)) {
              console.log(`⚠️ MENSAGEM já processada: ${aiMessageId}`);
              continue;
            }
            
            processedMessagesRef.current.add(aiMessageId);
            
            // ENVIAR VIA WHATSAPP
            const sendResult = await whatsappService.sendMessage(instanceId, message.from, blockContent);
            console.log(`📤 RESULTADO envio bloco ${i + 1}:`, sendResult.success ? 'SUCCESS' : 'FAILED');
            
            if (sendResult.success) {
              // REGISTRAR NO TICKET
              simulateMessageProgression(aiMessageId, true);
              
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
              
              console.log(`💾 MENSAGEM IA salva no ticket`);
            }
            
          } catch (sendError) {
            console.error(`❌ ERRO ao enviar bloco ${i + 1}:`, sendError);
          }
        }

        console.log('✅ RESPOSTA COMPLETA enviada');
        
        // MARCAR COMO LIDAS
        for (const msg of allMessages.filter(m => !m.fromMe)) {
          try {
            if (!processedMessagesRef.current.has(`read_${msg.id}`)) {
              processedMessagesRef.current.add(`read_${msg.id}`);
              await markAsRead(message.from, msg.id || msg.key?.id);
            }
          } catch (readError) {
            console.warn('⚠️ ERRO ao marcar como lida:', readError);
          }
        }
      }

    } catch (error) {
      console.error('❌ ERRO CRÍTICO no processamento:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
      }
      processingRef.current.delete(ticketId);
      console.log(`✅ PROCESSAMENTO finalizado (${processingKey})`);
    }
  }, [clientId, simulateHumanTyping, markAsRead, splitMessage, markActivity, simulateMessageProgression]);

  // Hook para agrupamento de mensagens COM ANTI-DUPLICAÇÃO
  const { addMessage, getBatchInfo, markBatchAsCompleted } = useMessageBatch(async (chatId: string, messages: any[]) => {
    console.log(`📦 ===== PROCESSBATCH CHAMADO =====`);
    console.log(`📱 Chat: ${chatId}`);
    console.log(`📨 Mensagens: ${messages.length}`);
    
    if (!mountedRef.current || messages.length === 0) {
      console.log('❌ COMPONENTE desmontado ou lote vazio');
      return;
    }

    // VERIFICAR MENSAGENS JÁ PROCESSADAS
    const newMessages = messages.filter(msg => {
      const msgKey = `batch_${msg.id || msg.key?.id}`;
      if (processedMessagesRef.current.has(msgKey)) {
        console.log(`⚠️ MENSAGEM já processada no lote: ${msgKey}`);
        return false;
      }
      processedMessagesRef.current.add(msgKey);
      return true;
    });

    if (newMessages.length === 0) {
      console.log('📦 TODAS mensagens já foram processadas');
      markBatchAsCompleted(chatId);
      return;
    }

    const clientMessages = newMessages.filter(msg => !msg.fromMe);
    
    if (clientMessages.length === 0) {
      console.log('📤 APENAS mensagens nossas - salvando...');
      
      for (const message of newMessages.filter(msg => msg.fromMe)) {
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
            console.log('💾 MENSAGEM nossa salva');
          }
        } catch (error) {
          console.error('❌ ERRO ao salvar mensagem nossa:', error);
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
    
    // PROCESSAR MENSAGENS DO CLIENTE
    const firstClientMessage = clientMessages[0];
    const normalizedMessage = normalizeWhatsAppMessage(firstClientMessage);
    
    console.log(`👤 PROCESSANDO mensagens do cliente: ${normalizedMessage.customerName}`);
    
    try {
      // CRIAR/ATUALIZAR TICKET
      const ticketId = await ticketsService.createOrUpdateTicket(
        clientId,
        normalizedMessage.from,
        clientId,
        normalizedMessage.customerName,
        normalizedMessage.phoneNumber,
        normalizedMessage.body,
        normalizedMessage.timestamp
      );

      console.log(`📋 TICKET criado/atualizado: ${ticketId}`);

      // SALVAR TODAS AS MENSAGENS
      for (const message of newMessages) {
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

      console.log(`💾 TODAS mensagens salvas no ticket`);

      // PROCESSAR REAÇÕES
      for (const message of clientMessages) {
        const normalized = normalizeWhatsAppMessage(message);
        await processReaction(normalized);
      }

      markActivity();

      // ATUALIZAR LISTA DE TICKETS
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);

      // PROCESSAMENTO COM ASSISTENTE - COM DEBOUNCE
      console.log(`🔍 VERIFICANDO processamento IA para ticket: ${ticketId}`);
      if (!processingRef.current.has(ticketId)) {
        console.log(`🤖 AGENDANDO processamento IA`);
        
        setTimeout(() => {
          if (mountedRef.current && !processingRef.current.has(ticketId)) {
            processWithAssistant(normalizedMessage, ticketId, clientMessages);
          }
        }, 1000); // Aumentei o delay para evitar duplicações
      } else {
        console.log(`⚠️ TICKET já sendo processado`);
      }
      
    } catch (error) {
      console.error('❌ ERRO ao processar lote:', error);
    } finally {
      markBatchAsCompleted(chatId);
    }
  });

  // CONFIGURAR LISTENERS - VERSÃO OTIMIZADA ANTI-DUPLICAÇÃO
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 ===== INICIALIZANDO LISTENERS =====');
    console.log(`👤 Cliente: ${clientId}`);
    
    initializationRef.current = true;
    mountedRef.current = true;

    // CARREGAR TICKETS INICIAL
    loadTickets();

    let socket: any = null;
    try {
      // CONECTAR WEBSOCKET
      socket = whatsappService.connectSocket();
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ WEBSOCKET conectado');
        whatsappService.joinClientRoom(clientId);
      });

      socket.on('disconnect', (reason: any) => {
        console.log('❌ WEBSOCKET desconectado:', reason);
      });

      // EVENTO PRINCIPAL DE MENSAGEM - SIMPLIFICADO
      const mainEventName = `message_${clientId}`;
      
      socket.on(mainEventName, async (message: any) => {
        if (!mountedRef.current) return;
        
        console.log(`📨 ===== EVENTO RECEBIDO =====`);
        console.log(`🏷️ Evento: ${mainEventName}`);
        console.log(`📨 Mensagem:`, {
          id: message.id,
          from: message.from,
          body: message.body?.substring(0, 50),
          fromMe: message.fromMe,
          type: message.type
        });
        
        // VERIFICAÇÃO ANTI-DUPLICAÇÃO
        const messageKey = `socket_${message.id || message.key?.id}`;
        if (processedMessagesRef.current.has(messageKey)) {
          console.log(`⚠️ MENSAGEM já processada via socket: ${messageKey}`);
          return;
        }
        
        // ADICIONAR À LISTA DE PROCESSADAS
        processedMessagesRef.current.add(messageKey);
        
        // PROCESSAR MENSAGEM
        addMessage(message);
      });

      // CANAL SUPABASE PARA MUDANÇAS NO BANCO
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
            console.log('🔄 MUDANÇA no banco detectada:', payload.eventType);
            if (mountedRef.current) {
              setTimeout(loadTickets, 1000);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      console.log('✅ LISTENERS configurados com sucesso');

    } catch (error) {
      console.error('❌ ERRO ao inicializar conexões:', error);
    }

    return () => {
      console.log('🔌 LIMPANDO recursos...');
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
    getBatchInfo,
    isAssistantTyping: (chatId: string) => isTyping(chatId),
    isAssistantRecording: (chatId: string) => isRecording(chatId)
  };
};
