
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

  // Processar mensagem individualmente com criação GARANTIDA de ticket
  const processMessage = useCallback(async (message: any) => {
    if (!mountedRef.current || !message) return;

    console.log('📨 Processando mensagem individual:', {
      id: message.id,
      from: message.from,
      chatId: message.chatId || message.from,
      fromMe: message.fromMe,
      body: message.body?.substring(0, 50),
      timestamp: message.timestamp
    });

    try {
      const chatId = message.chatId || message.from;
      const customerPhone = chatId.replace(/\D/g, '');
      const customerName = message.notifyName || 
                         message.pushName || 
                         message.sender ||
                         (customerPhone ? customerPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : null) ||
                         'Contato';

      console.log('🎫 SEMPRE criando ticket para:', {
        clientId,
        chatId,
        customerPhone,
        customerName
      });

      // SEMPRE criar ticket - mesmo se foi excluído antes
      const ticketId = await ticketsService.ensureTicketExists(
        clientId,
        chatId,
        clientId, // instance_id
        customerName,
        customerPhone,
        message.body || message.caption || '[Mídia]',
        new Date(message.timestamp || Date.now()).toISOString()
      );

      console.log('✅ Ticket garantido:', ticketId);

      // Processar reação automática apenas se não for minha mensagem
      if (!message.fromMe) {
        await processReaction(message);
      }

      // Preparar conteúdo da mensagem
      let content = message.body || message.caption || '';
      let messageType = message.type || 'text';
      
      if (message.type === 'image') {
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
      }

      if (message.quotedMessage) {
        const quotedContent = message.quotedMessage.body || message.quotedMessage.caption || '[Mídia citada]';
        content = `[Respondendo: "${quotedContent.substring(0, 50)}..."] ${content}`;
      }

      // Adicionar mensagem ao ticket
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: message.id,
        from_me: message.fromMe,
        sender_name: message.author || customerName,
        content: content,
        message_type: messageType,
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received',
        timestamp: new Date(message.timestamp || Date.now()).toISOString(),
        media_url: message.mediaUrl || null
      });

      markActivity();

      // Processar com assistente apenas se não estiver já processando e não for minha mensagem
      if (!message.fromMe && !processingRef.current.has(ticketId)) {
        processingRef.current.add(ticketId);
        setTimeout(() => {
          if (mountedRef.current) {
            processWithAssistant(message, ticketId);
          }
        }, 3000);
      }

      // Recarregar tickets para atualizar a lista
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }, [clientId, processReaction, markActivity]);

  // Processar lote de mensagens - REMOVIDO e substituído por processamento individual
  const processBatchWithAssistant = useCallback(async (chatId: string, messages: any[]) => {
    console.log(`📦 Processando lote de ${messages.length} mensagens`);
    
    // Processar cada mensagem individualmente para garantir que todas sejam capturadas
    for (const message of messages) {
      await processMessage(message);
    }
  }, [processMessage]);

  const { addMessage } = useMessageBatch(processBatchWithAssistant);

  // Carregar tickets
  const loadTickets = useCallback(async () => {
    const now = Date.now();
    if (!clientId || !mountedRef.current || (now - lastLoadTimeRef.current) < 2000) {
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
  const processWithAssistant = useCallback(async (message: any, ticketId: string) => {
    if (!mountedRef.current || !ticketId) {
      processingRef.current.delete(ticketId);
      return;
    }
    
    const messageKey = `${message.id}_${ticketId}`;
    if (processedMessagesRef.current.has(messageKey)) {
      processingRef.current.delete(ticketId);
      return;
    }
    
    console.log('🤖 Processando mensagem com assistente:', message.id);
    processedMessagesRef.current.add(messageKey);
    
    try {
      setAssistantTyping(true);
      
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('⚠️ Configuração de IA não encontrada');
        return;
      }

      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        return;
      }

      const assistant = activeQueue.assistants;
      console.log(`🤖 Usando assistente: ${assistant.name} na fila: ${activeQueue.name}`);

      await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: activeQueue.id,
          assigned_assistant_id: assistant.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      const ticketMessages = await ticketsService.getTicketMessages(ticketId, 40);
      
      const contextMessages = ticketMessages.map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.content,
        timestamp: msg.timestamp
      })).reverse();

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

      const currentMessage = message.body || message.caption || '[Mídia]';
      await simulateHumanTyping(message.from, currentMessage);
      await markAsRead(message.from, message.id);

      const messages = [
        {
          role: 'system',
          content: `${assistant.prompt || 'Você é um assistente útil.'}\n\nContexto: Você está respondendo mensagens do WhatsApp. Responda de forma natural e humanizada.`
        },
        ...contextMessages.slice(-20),
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
        
        await simulateHumanTyping(message.from, assistantResponse);
        await whatsappService.sendMessage(clientId, message.from, assistantResponse);
        
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

  // Configurar listeners
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Inicializando listeners para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    loadTickets();

    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      whatsappService.joinClientRoom(clientId);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
    });

    // Listener para mensagens do WhatsApp - SIMPLIFICADO para processar tudo
    const messageEvent = `message_${clientId}`;
    const handleNewMessage = async (message: any) => {
      console.log('📨 NOVA MENSAGEM RECEBIDA - PROCESSAMENTO DIRETO:', {
        id: message.id,
        from: message.from,
        fromMe: message.fromMe,
        type: message.type,
        body: message.body?.substring(0, 50),
        timestamp: message.timestamp
      });
      
      if (!mountedRef.current) {
        console.log('⚠️ Componente desmontado, ignorando mensagem');
        return;
      }
      
      // PROCESSAR DIRETAMENTE - não usar batch
      await processMessage(message);
    };

    socket.on(messageEvent, handleNewMessage);

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
        () => {
          if (mountedRef.current) {
            setTimeout(loadTickets, 1000);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 Limpando recursos...');
      mountedRef.current = false;
      initializationRef.current = false;
      
      if (socketRef.current) {
        socketRef.current.off(messageEvent, handleNewMessage);
        socketRef.current.disconnect();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      processedMessagesRef.current.clear();
      processingRef.current.clear();
    };
  }, [clientId, loadTickets, processMessage]);

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
