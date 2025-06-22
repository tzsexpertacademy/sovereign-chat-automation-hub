
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
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks humanizados
  const { simulateHumanTyping, markAsRead } = useHumanizedTyping(clientId);
  const { processMessage: processReaction } = useAutoReactions(clientId, true);
  const { isOnline, markActivity } = useOnlineStatus(clientId, true);

  // FUNÇÃO PARA FORÇAR ATUALIZAÇÃO DA UI
  const forceUIUpdate = useCallback(() => {
    console.log('🔄 FORÇANDO ATUALIZAÇÃO IMEDIATA DA UI...');
    loadTickets();
    
    // Múltiplas tentativas para garantir que a UI seja atualizada
    setTimeout(() => {
      if (mountedRef.current) {
        console.log('🔄 Segunda tentativa de atualização UI...');
        loadTickets();
      }
    }, 500);
    
    setTimeout(() => {
      if (mountedRef.current) {
        console.log('🔄 Terceira tentativa de atualização UI...');
        loadTickets();
      }
    }, 1500);
  }, []);

  // FUNÇÃO DE DEBUG COMPLETA
  const comprehensiveDebug = useCallback(async () => {
    console.log('🔍 ===== DEBUG COMPLETO INICIADO =====');
    console.log('🔍 Client ID:', clientId);
    
    try {
      // 1. Verificar TODAS as mensagens no banco
      console.log('🔍 1. VERIFICANDO MENSAGENS NO BANCO...');
      const { data: allMessages, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('instance_id', clientId)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (msgError) {
        console.error('❌ Erro ao buscar mensagens:', msgError);
      } else {
        console.log('📊 Mensagens encontradas:', allMessages?.length || 0);
        if (allMessages && allMessages.length > 0) {
          allMessages.forEach((msg, index) => {
            console.log(`📨 Mensagem ${index + 1}:`, {
              id: msg.id,
              chat_id: msg.chat_id,
              body: msg.body?.substring(0, 50),
              timestamp: msg.timestamp,
              from_me: msg.from_me,
              is_processed: msg.is_processed
            });
          });
        }
      }

      // 2. Verificar TODOS os tickets
      console.log('🔍 2. VERIFICANDO TICKETS NO BANCO...');
      const { data: allTickets, error: ticketError } = await supabase
        .from('conversation_tickets')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false });

      if (ticketError) {
        console.error('❌ Erro ao buscar tickets:', ticketError);
      } else {
        console.log('🎫 Tickets no banco:', allTickets?.length || 0);
        if (allTickets && allTickets.length > 0) {
          allTickets.forEach((ticket, index) => {
            console.log(`🎫 Ticket ${index + 1}:`, {
              id: ticket.id,
              chat_id: ticket.chat_id,
              title: ticket.title,
              last_message_at: ticket.last_message_at,
              status: ticket.status
            });
          });
        }
      }

      // 3. Comparar com estado atual da UI
      console.log('🔍 3. ESTADO ATUAL DA UI...');
      console.log('📊 Tickets na UI:', tickets.length);
      console.log('📊 Tickets carregados:', tickets.map(t => ({
        id: t.id,
        title: t.title,
        chat_id: t.chat_id
      })));

      // 4. FORÇA RECARGA TOTAL
      console.log('🔍 4. FORÇANDO RECARGA TOTAL...');
      forceUIUpdate();

    } catch (error) {
      console.error('❌ Erro no debug:', error);
    }
    
    console.log('🔍 ===== DEBUG COMPLETO FINALIZADO =====');
  }, [clientId, tickets, forceUIUpdate]);

  // PROCESSAMENTO DE MENSAGEM MAIS DIRETO
  const processMessage = useCallback(async (message: any) => {
    if (!mountedRef.current || !message) return;

    console.log('📨 ===== PROCESSANDO MENSAGEM =====');
    console.log('📨 Dados completos:', message);

    try {
      // Extrair dados básicos
      const chatId = message.chatId || message.from || message.chat_id;
      if (!chatId) {
        console.error('❌ Chat ID não encontrado');
        return;  
      }

      const customerPhone = chatId.replace(/\D/g, '');
      const customerName = message.notifyName || message.pushName || message.sender || 
                          customerPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      const messageContent = message.body || message.caption || message.text || '[Mídia]';

      console.log('📨 Dados processados:', {
        chatId,
        customerPhone,
        customerName,
        messageContent: messageContent.substring(0, 50)
      });

      // Criar/atualizar ticket
      const ticketId = await ticketsService.ensureTicketExists(
        clientId,
        chatId,
        clientId,
        customerName,
        customerPhone,
        messageContent,
        new Date(message.timestamp || Date.now()).toISOString()
      );

      console.log('✅ Ticket processado:', ticketId);

      // Adicionar mensagem ao ticket
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: message.id || `msg_${Date.now()}`,
        from_me: message.fromMe || false,
        sender_name: customerName,
        content: messageContent,
        message_type: message.type || 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received',
        timestamp: new Date(message.timestamp || Date.now()).toISOString(),
        media_url: message.mediaUrl || null
      });

      console.log('✅ Mensagem adicionada ao ticket');

      // FORÇA ATUALIZAÇÃO IMEDIATA DA UI
      forceUIUpdate();

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }, [clientId, forceUIUpdate]);

  const processBatchWithAssistant = useCallback(async (chatId: string, messages: any[]) => {
    console.log(`📦 Processando lote de ${messages.length} mensagens`);
    
    for (const message of messages) {
      await processMessage(message);
    }
  }, [processMessage]);

  const { addMessage } = useMessageBatch(processBatchWithAssistant);

  // CARREGAR TICKETS COM LOGS DETALHADOS
  const loadTickets = useCallback(async () => {
    if (!clientId || !mountedRef.current) return;
    
    try {
      setIsLoading(true);
      console.log('🔄 ===== CARREGANDO TICKETS =====');
      console.log('🔄 Client ID:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets retornados do service:', ticketsData.length);
      
      if (ticketsData.length > 0) {
        console.log('📊 Primeiro ticket:', {
          id: ticketsData[0].id,
          title: ticketsData[0].title,
          chat_id: ticketsData[0].chat_id,
          last_message_at: ticketsData[0].last_message_at
        });
      }
      
      if (mountedRef.current) {
        setTickets(ticketsData);
        console.log('✅ Estado atualizado com', ticketsData.length, 'tickets');
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // CONFIGURAR LISTENERS COM MAIS EVENTOS
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 ===== INICIALIZANDO SISTEMA =====');
    initializationRef.current = true;
    mountedRef.current = true;

    // Carregar tickets imediatamente
    loadTickets();

    // Conectar WebSocket
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      whatsappService.joinClientRoom(clientId);
    });

    // TODOS OS EVENTOS POSSÍVEIS
    const messageEvents = [
      `message_${clientId}`,
      `new_message_${clientId}`,
      `whatsapp_message_${clientId}`,
      `incoming_message_${clientId}`,
      'message',
      'new_message',
      'whatsapp_message'
    ];

    const handleMessage = async (message: any) => {
      console.log('📨 MENSAGEM VIA WEBSOCKET:', message);
      await processMessage(message);
    };

    messageEvents.forEach(event => {
      console.log(`🎧 Registrando evento: ${event}`);
      socket.on(event, handleMessage);
    });

    // Canal Supabase MAIS AGRESSIVO
    const channel = supabase
      .channel(`realtime-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          console.log('📊 MUDANÇA EM TICKET:', payload);
          forceUIUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `instance_id=eq.${clientId}`
        },
        async (payload) => {
          console.log('📨 NOVA MENSAGEM NO BANCO:', payload);
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const messageData = payload.new as any;
            const message = {
              id: messageData.id,
              from: messageData.chat_id,
              chatId: messageData.chat_id,
              fromMe: messageData.from_me,
              body: messageData.body,
              type: messageData.message_type,
              timestamp: messageData.timestamp,
              sender: messageData.sender
            };
            await processMessage(message);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('🔌 Limpando recursos...');
      mountedRef.current = false;
      initializationRef.current = false;
      
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
      
      if (socketRef.current) {
        messageEvents.forEach(event => {
          socketRef.current.off(event, handleMessage);
        });
        socketRef.current.disconnect();
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clientId, processMessage, forceUIUpdate]);

  const reloadTickets = useCallback(() => {
    console.log('🔄 RELOAD MANUAL SOLICITADO');
    forceUIUpdate();
  }, [forceUIUpdate]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline,
    reloadTickets,
    debugMessages: comprehensiveDebug
  };
};
