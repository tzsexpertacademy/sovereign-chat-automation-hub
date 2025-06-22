
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { aiConfigService } from '@/services/aiConfigService';
import { useMessageBatch } from './useMessageBatch';
import { useHumanizedTyping } from './useHumanizedTyping';
import { useAutoReactions } from './useAutoReactions';
import { useOnlineStatus } from './useOnlineStatus';

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
  const { simulateHumanTyping, markAsRead } = useHumanizedTyping(clientId);
  const { processMessage: processReaction } = useAutoReactions(clientId, true);
  const { isOnline, markActivity } = useOnlineStatus(clientId, true);

  // Função para validar timestamp
  const validateTimestamp = useCallback((timestamp: any): string => {
    console.log('🕐 Validando timestamp:', timestamp);
    
    if (!timestamp) {
      return new Date().toISOString();
    }
    
    let date: Date;
    
    if (typeof timestamp === 'number') {
      // Se for um número, verificar se está em segundos ou milissegundos
      if (timestamp.toString().length === 10) {
        // Segundos - converter para milissegundos
        date = new Date(timestamp * 1000);
      } else if (timestamp.toString().length === 13) {
        // Milissegundos
        date = new Date(timestamp);
      } else {
        // Timestamp inválido, usar data atual
        console.log('⚠️ Timestamp numérico inválido:', timestamp);
        date = new Date();
      }
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      console.log('⚠️ Tipo de timestamp desconhecido:', typeof timestamp);
      date = new Date();
    }
    
    // Verificar se a data é válida e não está no futuro distante
    if (isNaN(date.getTime()) || date.getFullYear() > 2030) {
      console.log('⚠️ Data inválida ou muito futura, usando data atual');
      date = new Date();
    }
    
    // Verificar se a data não é muito antiga (antes de 2020)
    if (date.getFullYear() < 2020) {
      console.log('⚠️ Data muito antiga, usando data atual');
      date = new Date();
    }
    
    const validTimestamp = date.toISOString();
    console.log('✅ Timestamp validado:', validTimestamp);
    return validTimestamp;
  }, []);

  // Função para normalizar dados da mensagem do WhatsApp
  const normalizeWhatsAppMessage = useCallback((message: any) => {
    console.log('📨 Normalizando mensagem WhatsApp raw:', message);
    
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
    const timestamp = validateTimestamp(message.timestamp || message.t || Date.now());

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
  }, [validateTimestamp]);

  // Processar lote de mensagens com assistente
  const processBatchWithAssistant = useCallback(async (chatId: string, messages: any[]) => {
    if (!mountedRef.current || messages.length === 0) return;

    console.log(`📦 Processando lote de ${messages.length} mensagens do chat ${chatId}`);
    
    // Usar apenas a última mensagem para resposta do assistente
    const lastMessage = messages[messages.length - 1];
    const normalizedMessage = normalizeWhatsAppMessage(lastMessage);
    
    // Só processar se não for mensagem enviada por nós
    if (normalizedMessage.fromMe) {
      console.log('📤 Mensagem enviada por nós, não processando');
      return;
    }
    
    try {
      // Processar reações automáticas para todas as mensagens
      for (const message of messages) {
        if (!message.fromMe) {
          const normalized = normalizeWhatsAppMessage(message);
          await processReaction(normalized);
        }
      }

      console.log('👤 Criando/atualizando ticket para:', {
        clientId,
        chatId: normalizedMessage.from,
        customerName: normalizedMessage.customerName,
        phoneNumber: normalizedMessage.phoneNumber
      });
      
      // Criar/atualizar ticket
      const ticketId = await ticketsService.createOrUpdateTicket(
        clientId,
        normalizedMessage.from,
        clientId, // Usar clientId como instance_id temporariamente
        normalizedMessage.customerName,
        normalizedMessage.phoneNumber,
        normalizedMessage.body,
        normalizedMessage.timestamp
      );

      console.log('📋 Ticket processado:', ticketId);

      // Adicionar todas as mensagens do lote ao ticket
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

      // Marcar atividade online
      markActivity();

      // Processar com assistente apenas se não estiver já processando
      if (!processingRef.current.has(ticketId)) {
        processingRef.current.add(ticketId);
        setTimeout(() => {
          if (mountedRef.current) {
            processWithAssistant(normalizedMessage, ticketId, messages);
          }
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar lote de mensagens:', error);
    }
  }, [clientId, processReaction, markActivity, normalizeWhatsAppMessage]);

  // Hook para agrupamento de mensagens
  const { addMessage } = useMessageBatch(processBatchWithAssistant);

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

  // Processar mensagem com assistente
  const processWithAssistant = useCallback(async (message: any, ticketId: string, allMessages: any[] = []) => {
    if (!mountedRef.current || !ticketId) {
      processingRef.current.delete(ticketId);
      return;
    }
    
    // Verificar duplicação por ID da mensagem
    const messageKey = `${message.id}_${ticketId}`;
    if (processedMessagesRef.current.has(messageKey)) {
      processingRef.current.delete(ticketId);
      return;
    }
    
    console.log('🤖 Processando mensagem com assistente:', message.id);
    processedMessagesRef.current.add(messageKey);
    
    try {
      setAssistantTyping(true);
      
      // Buscar configurações necessárias
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('⚠️ Configuração de IA não encontrada');
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

      // Atualizar ticket com informações da fila
      await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: activeQueue.id,
          assigned_assistant_id: assistant.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      // Buscar contexto das últimas 40 mensagens do ticket
      const ticketMessages = await ticketsService.getTicketMessages(ticketId, 40);
      
      // Preparar contexto para IA
      const contextMessages = ticketMessages.map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.content,
        timestamp: msg.timestamp
      })).reverse(); // Ordem cronológica

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

      // Simular digitação humana baseada no tamanho da resposta esperada
      const currentMessage = message.body || message.caption || '[Mídia]';
      await simulateHumanTyping(message.from, currentMessage);

      // Marcar mensagem como lida
      await markAsRead(message.from, message.id);

      // Chamar OpenAI com contexto completo
      const messages = [
        {
          role: 'system',
          content: `${assistant.prompt || 'Você é um assistente útil.'}\n\nContexto: Você está respondendo mensagens do WhatsApp. Responda de forma natural e humanizada.`
        },
        ...contextMessages.slice(-20), // Últimas 20 mensagens para contexto
        {
          role: 'user',
          content: currentMessage
        }
      ];

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
        console.log('🤖 Enviando resposta:', assistantResponse.substring(0, 100));
        
        // Simular delay de digitação baseado no tamanho da resposta
        await simulateHumanTyping(message.from, assistantResponse);
        
        // Enviar via WhatsApp usando a instância correta
        await whatsappService.sendMessage(instanceId, message.from, assistantResponse);
        
        // Registrar no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

        console.log('✅ Resposta enviada com sucesso');
      }

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
      }
      processingRef.current.delete(ticketId);
    }
  }, [clientId, simulateHumanTyping, markAsRead]);

  // Configurar listeners uma única vez
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Inicializando listeners para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    // Carregar tickets inicial
    loadTickets();

    // Conectar ao WebSocket com melhor tratamento de erros
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

      // Listeners mais específicos para diferentes tipos de eventos
      const events = [
        `message_${clientId}`,
        `new_message_${clientId}`,
        `whatsapp_message_${clientId}`,
        `message`
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
          
          // Só processar mensagens que não são nossas
          if (!message.fromMe) {
            addMessage(message);
          }
        });
      });

      // Listener genérico para debug
      socket.onAny((eventName: string, ...args: any[]) => {
        if (eventName.includes(clientId) || eventName.includes('message')) {
          console.log(`🔔 Evento WebSocket: ${eventName}`, args);
        }
      });

      // Canal do Supabase para atualizações
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
    reloadTickets
  };
};
