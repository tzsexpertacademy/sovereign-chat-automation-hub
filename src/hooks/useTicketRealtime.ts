
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

  // Hooks humanizados aprimorados
  const { simulateHumanTyping, markAsRead, isTyping, isRecording } = useHumanizedTyping(clientId);
  const { processMessage: processReaction } = useAutoReactions(clientId, true);
  const { isOnline, markActivity } = useOnlineStatus(clientId, true);
  const { splitMessage } = useSmartMessageSplit();
  const { simulateMessageProgression } = useMessageStatus();

  // Função para normalizar dados da mensagem do WhatsApp
  const normalizeWhatsAppMessage = useCallback((message: any) => {
    console.log('📨 NORMALIZANDO mensagem WhatsApp:', {
      id: message.id,
      from: message.from,
      body: message.body?.substring(0, 50),
      fromMe: message.fromMe,
      timestamp: message.timestamp
    });
    
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

    console.log('✅ MENSAGEM normalizada:', {
      id: normalizedMessage.id,
      from: normalizedMessage.from,
      customerName: normalizedMessage.customerName,
      body: normalizedMessage.body.substring(0, 50),
      fromMe: normalizedMessage.fromMe
    });
    
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

  // VERSÃO SIMPLIFICADA E FOCADA - Processar com assistente
  const processWithAssistant = useCallback(async (message: any, ticketId: string, allMessages: any[] = []) => {
    if (!mountedRef.current || !ticketId) {
      console.log('❌ COMPONENTE desmontado ou ticketId inválido');
      processingRef.current.delete(ticketId);
      return;
    }
    
    console.log(`🤖 ===== INICIANDO PROCESSAMENTO IA =====`);
    console.log(`📋 Ticket: ${ticketId}`);
    console.log(`📨 Mensagens para processar: ${allMessages.length}`);
    
    try {
      setAssistantTyping(true);
      console.log('🤖 ASSISTENTE iniciou digitação');
      
      markActivity();
      
      // BUSCAR CONFIGURAÇÕES CRÍTICAS
      console.log('🔍 BUSCANDO configurações...');
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      console.log('📊 CONFIGURAÇÕES encontradas:', {
        queuesCount: queues.length,
        hasAiConfig: !!aiConfig,
        hasOpenAiKey: !!aiConfig?.openai_api_key?.substring(0, 10)
      });

      // VERIFICAÇÃO CRÍTICA - SEM IA CONFIG = SEM PROCESSAMENTO
      if (!aiConfig?.openai_api_key) {
        console.log('❌ SEM configuração de IA - PARANDO processamento');
        return;
      }

      // FILA ATIVA COM ASSISTENTE
      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('❌ NENHUMA fila ativa com assistente - PARANDO');
        return;
      }

      const assistant = activeQueue.assistants;
      console.log(`🤖 USANDO assistente: "${assistant.name}" na fila: "${activeQueue.name}"`);

      // INSTÂNCIA WHATSAPP
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId)
        .eq('status', 'connected')
        .limit(1);

      if (!instances || instances.length === 0) {
        console.log('❌ NENHUMA instância WhatsApp conectada');
        return;
      }

      const instanceId = instances[0].instance_id;
      console.log(`📱 USANDO instância: ${instanceId}`);

      // ATUALIZAR TICKET COM FILA
      await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: activeQueue.id,
          assigned_assistant_id: assistant.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      // BUSCAR CONTEXTO COMPLETO DO BANCO
      console.log('📚 BUSCANDO contexto do banco...');
      const ticketMessages = await ticketsService.getTicketMessages(ticketId, 50);
      console.log(`📚 CONTEXTO carregado: ${ticketMessages.length} mensagens`);

      // PREPARAR CONFIGURAÇÕES DO ASSISTENTE
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

      // PREPARAR MENSAGENS ATUAIS DO CLIENTE
      const currentBatchContent = allMessages
        .filter(msg => !msg.fromMe)
        .map(msg => msg.body || msg.caption || '[Mídia]')
        .join('\n');
      
      console.log('📝 CONTEÚDO atual do lote:', currentBatchContent.substring(0, 100));

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
        ...contextMessages.slice(-10), // Últimas 10 mensagens
        { role: 'user', content: `NOVA MENSAGEM: ${currentBatchContent}` }
      ];

      console.log(`🚀 ENVIANDO para OpenAI (${messages.length} mensagens)`);

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

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 RESPOSTA recebida (${assistantResponse.length} chars):`, assistantResponse.substring(0, 100));
        
        // SIMULAR DIGITAÇÃO
        try {
          await simulateHumanTyping(message.from, assistantResponse);
        } catch (typingError) {
          console.warn('⚠️ ERRO na simulação de digitação:', typingError);
        }
        
        // QUEBRAR EM BLOCOS SE NECESSÁRIO
        const messageBlocks = splitMessage(assistantResponse);
        console.log(`📝 RESPOSTA dividida em ${messageBlocks.length} blocos`);
        
        // ENVIAR CADA BLOCO
        for (let i = 0; i < messageBlocks.length; i++) {
          if (!mountedRef.current) break;
          
          const blockContent = messageBlocks[i];
          console.log(`📤 ENVIANDO bloco ${i + 1}/${messageBlocks.length}`);
          
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          try {
            // ENVIAR VIA WHATSAPP
            const sendResult = await whatsappService.sendMessage(instanceId, message.from, blockContent);
            console.log(`📤 RESULTADO envio bloco ${i + 1}:`, sendResult.success ? 'SUCCESS' : 'FAILED');
            
            // REGISTRAR NO TICKET
            const aiMessageId = `ai_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
            
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
            
          } catch (sendError) {
            console.error(`❌ ERRO ao enviar bloco ${i + 1}:`, sendError);
          }
        }

        console.log('✅ RESPOSTA COMPLETA enviada');
        
        // MARCAR COMO LIDAS
        for (const msg of allMessages.filter(m => !m.fromMe)) {
          try {
            await markAsRead(message.from, msg.id || msg.key?.id);
          } catch (readError) {
            console.warn('⚠️ ERRO ao marcar como lida:', readError);
          }
        }
      } else {
        console.log('⚠️ RESPOSTA vazia da IA');
      }

    } catch (error) {
      console.error('❌ ERRO CRÍTICO no processamento:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
        console.log('🤖 ASSISTENTE parou de digitar');
      }
      processingRef.current.delete(ticketId);
      console.log('✅ PROCESSAMENTO finalizado');
    }
  }, [clientId, simulateHumanTyping, markAsRead, splitMessage, markActivity, simulateMessageProgression]);

  // Hook para agrupamento de mensagens SIMPLIFICADO
  const { addMessage, getBatchInfo, markBatchAsCompleted } = useMessageBatch(async (chatId: string, messages: any[]) => {
    console.log(`📦 ===== PROCESSBATCH CHAMADO =====`);
    console.log(`📱 Chat: ${chatId}`);
    console.log(`📨 Mensagens: ${messages.length}`);
    
    if (!mountedRef.current || messages.length === 0) {
      console.log('❌ COMPONENTE desmontado ou lote vazio');
      return;
    }

    // LOG DETALHADO DAS MENSAGENS
    messages.forEach((msg, index) => {
      console.log(`📨 MSG ${index + 1}:`, {
        id: msg.id,
        content: msg.body?.substring(0, 30),
        fromMe: msg.fromMe,
        timestamp: new Date(msg.timestamp || Date.now()).toLocaleTimeString()
      });
    });
    
    const clientMessages = messages.filter(msg => !msg.fromMe);
    
    if (clientMessages.length === 0) {
      console.log('📤 APENAS mensagens nossas - salvando...');
      
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
              console.log('💾 MENSAGEM nossa salva');
            }
          } catch (error) {
            console.error('❌ ERRO ao salvar mensagem nossa:', error);
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

      // PROCESSAMENTO COM ASSISTENTE
      console.log(`🔍 VERIFICANDO processamento IA para ticket: ${ticketId}`);
      if (!processingRef.current.has(ticketId)) {
        processingRef.current.add(ticketId);
        console.log(`🤖 INICIANDO processamento IA`);
        
        setTimeout(() => {
          if (mountedRef.current && processingRef.current.has(ticketId)) {
            processWithAssistant(normalizedMessage, ticketId, clientMessages);
          }
        }, 800);
      } else {
        console.log(`⚠️ TICKET já sendo processado`);
        setTimeout(() => {
          processingRef.current.delete(ticketId);
        }, 30000);
      }
      
    } catch (error) {
      console.error('❌ ERRO ao processar lote:', error);
    } finally {
      markBatchAsCompleted(chatId);
    }
  });

  // CONFIGURAR LISTENERS - VERSÃO SIMPLIFICADA E ROBUSTA
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

      socket.on('connect_error', (error: any) => {
        console.error('❌ ERRO conexão WebSocket:', error);
      });

      // EVENTOS DE MENSAGEM - LISTA EXPANDIDA
      const events = [
        `message_${clientId}`,
        `new_message_${clientId}`,
        `whatsapp_message_${clientId}`,
        `message`,
        `incoming_message_${clientId}`,
        `message_received_${clientId}`
      ];

      events.forEach(eventName => {
        socket.on(eventName, async (message: any) => {
          if (!mountedRef.current) return;
          
          console.log(`📨 ===== EVENTO RECEBIDO =====`);
          console.log(`🏷️ Evento: ${eventName}`);
          console.log(`📨 Mensagem:`, {
            id: message.id,
            from: message.from,
            body: message.body?.substring(0, 50),
            fromMe: message.fromMe,
            type: message.type
          });
          
          // IMPORTANTE: Processar TODAS as mensagens que chegam
          addMessage(message);
        });
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
