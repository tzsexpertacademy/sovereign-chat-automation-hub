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
  const lastProcessTimeRef = useRef<Map<string, number>>(new Map());

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

  // Processar CADA mensagem individual do cliente - SEM AGRUPAMENTO
  const processIndividualMessage = useCallback(async (message: any, ticketId: string) => {
    if (!mountedRef.current || !ticketId) {
      console.log('❌ Componente desmontado ou ticketId inválido, cancelando processamento IA');
      return;
    }

    // Verificar se é mensagem do cliente (não nossa)
    if (message.fromMe) {
      console.log('📤 Mensagem nossa ignorada para processamento IA:', message.body?.substring(0, 50));
      return;
    }

    // Verificar se não processamos esta mensagem recentemente
    const chatId = message.from;
    const messageKey = `${chatId}_${message.id}`;
    const now = Date.now();
    const lastProcessTime = lastProcessTimeRef.current.get(messageKey) || 0;
    
    if (now - lastProcessTime < 5000) { // 5 segundos de debounce por mensagem específica
      console.log('⏳ Mensagem processada recentemente, ignorando:', messageKey);
      return;
    }
    
    lastProcessTimeRef.current.set(messageKey, now);
    
    console.log(`🤖 PROCESSANDO MENSAGEM INDIVIDUAL - Ticket: ${ticketId}`);
    console.log(`📝 Conteúdo: "${message.body?.substring(0, 100)}"`);
    
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

      // Buscar contexto completo sempre do banco
      console.log('📚 Buscando contexto SEMPRE atualizado do banco de dados...');
      const ticketMessages = await ticketsService.getTicketMessages(ticketId, 50);
      const contextMessages = ticketMessages.map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.content,
        timestamp: msg.timestamp,
        messageId: msg.message_id
      }));
      
      console.log(`📚 Contexto FRESCO carregado: ${contextMessages.length} mensagens`);
      console.log('📝 Últimas 3 mensagens do contexto:', contextMessages.slice(-3).map(m => ({
        role: m.role,
        content: m.content?.substring(0, 100)
      })));
      
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

      // Criar mensagens para OpenAI - SISTEMA INTELIGENTE
      const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nVocê está em uma conversa do WhatsApp. Analise todo o contexto e responda de forma natural e contextual à nova mensagem do cliente. Seja direto, útil e mantenha o tom conversacional do WhatsApp.`;

      // Usar contexto limitado mais a mensagem atual
      const recentContext = contextMessages.slice(-20);
      
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...recentContext,
        {
          role: 'user',
          content: message.body || ''
        }
      ];

      console.log('🚀 Chamando OpenAI com contexto individual:', {
        totalMessages: messages.length,
        currentMessage: message.body?.substring(0, 100),
        recentContextSize: recentContext.length
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
        console.log(`🤖 Resposta individual gerada (${assistantResponse.length} caracteres):`, assistantResponse.substring(0, 200));
        
        // Simular digitação com delay menor para respostas mais fluidas
        await simulateHumanTyping(message.from, assistantResponse);
        
        // Delay humanizado reduzido
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (!mountedRef.current) return;
        
        console.log(`📤 Enviando resposta individual: ${assistantResponse.substring(0, 100)}`);
        
        // Enviar via WhatsApp
        const sendResult = await whatsappService.sendMessage(instanceId, message.from, assistantResponse);
        console.log(`📤 Resultado do envio individual:`, sendResult);
        
        // Registrar no ticket
        const aiMessageId = `ai_individual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: aiMessageId,
          from_me: true,
          sender_name: `🤖 ${assistant.name}`,
          content: assistantResponse,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: true,
          ai_confidence_score: 0.9,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta individual enviada e registrada');
        
        // Marcar mensagem como lida
        await markAsRead(message.from, message.id || message.key?.id);
      } else {
        console.log('⚠️ Resposta do assistente vazia ou inválida:', assistantResponse);
      }

    } catch (error) {
      console.error('❌ Erro no processamento individual:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
        console.log('🤖 Assistente parou de digitar');
      }
      console.log('✅ Processamento individual finalizado');
    }
  }, [clientId, simulateHumanTyping, markAsRead]);

  // Hook para processamento sem agrupamento - cada mensagem é processada individualmente
  const { addMessage, getBatchInfo, markBatchAsCompleted, updateCallback } = useMessageBatch(async (chatId: string, messages: any[]) => {
    console.log(`📦 BATCH RECEBIDO - chatId: ${chatId}, mensagens: ${messages.length}`);
    
    if (!mountedRef.current || messages.length === 0) {
      console.log('❌ Componente desmontado ou lote vazio, cancelando');
      return;
    }

    try {
      // Primeiro salvar todas as mensagens
      for (const message of messages) {
        const normalizedMessage = normalizeWhatsAppMessage(message);
        
        console.log('💾 Processando mensagem individual:', {
          id: normalizedMessage.id,
          content: normalizedMessage.body?.substring(0, 50),
          fromMe: normalizedMessage.fromMe
        });
        
        // Criar ou atualizar ticket
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

        // Salvar mensagem
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: normalizedMessage.id,
          from_me: normalizedMessage.fromMe,
          sender_name: normalizedMessage.author,
          content: normalizedMessage.body,
          message_type: normalizedMessage.type,
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'received',
          timestamp: normalizedMessage.timestamp,
          media_url: normalizedMessage.mediaUrl
        });

        // Se for mensagem do cliente, processar IMEDIATAMENTE cada uma
        if (!normalizedMessage.fromMe) {
          console.log('👤 Mensagem do cliente - processando INDIVIDUALMENTE');
          
          // Processamento em background para não bloquear
          setTimeout(() => {
            if (mountedRef.current) {
              processIndividualMessage(normalizedMessage, ticketId);
            }
          }, 500); // Delay pequeno para garantir que a mensagem foi salva
        }

        // Processar reações
        await processReaction(normalizedMessage);
      }

      markActivity();

      // Recarregar tickets
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao processar batch:', error);
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
      lastProcessTimeRef.current.clear();
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
