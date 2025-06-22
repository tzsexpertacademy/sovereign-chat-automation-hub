
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

  // FUNÇÃO DE DEBUG MELHORADA
  const comprehensiveDebug = useCallback(async () => {
    console.log('🔍 ===== DEBUG COMPLETO INICIADO =====');
    console.log('🔍 Client ID:', clientId);
    console.log('🔍 Data/Hora:', new Date().toISOString());
    
    // 1. Testar conexão WebSocket
    console.log('🔍 1. TESTANDO WEBSOCKET...');
    if (socketRef.current) {
      console.log('✅ Socket existe:', {
        connected: socketRef.current.connected,
        id: socketRef.current.id,
        listeners: Object.keys(socketRef.current._callbacks || {})
      });
    } else {
      console.log('❌ Socket não existe!');
    }
    
    // 2. Verificar mensagens no banco - TODAS AS MENSAGENS
    console.log('🔍 2. VERIFICANDO TODAS AS MENSAGENS NO BANCO...');
    try {
      const { data: allMessages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('instance_id', clientId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Erro ao buscar mensagens:', error);
      } else {
        console.log('📊 Últimas 10 mensagens no banco:', allMessages);
        if (allMessages && allMessages.length > 0) {
          allMessages.forEach((msg, index) => {
            console.log(`📊 Mensagem ${index + 1}:`, {
              id: msg.id,
              chat_id: msg.chat_id,
              body: msg.body?.substring(0, 50),
              timestamp: msg.timestamp,
              from_me: msg.from_me,
              sender: msg.sender,
              is_processed: msg.is_processed
            });
          });
        } else {
          console.log('⚠️ NENHUMA MENSAGEM ENCONTRADA NO BANCO!');
        }
      }
    } catch (error) {
      console.error('❌ Erro na busca de mensagens:', error);
    }

    // 3. Verificar todos os tickets
    console.log('🔍 3. VERIFICANDO TODOS OS TICKETS...');
    try {
      const { data: allTickets, error } = await supabase
        .from('conversation_tickets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar tickets:', error);
      } else {
        console.log('📊 Todos os tickets encontrados:', allTickets?.length || 0);
        if (allTickets && allTickets.length > 0) {
          allTickets.forEach((ticket, index) => {
            console.log(`🎫 Ticket ${index + 1}:`, {
              id: ticket.id,
              chat_id: ticket.chat_id,
              title: ticket.title,
              status: ticket.status,
              last_message_at: ticket.last_message_at,
              is_archived: ticket.is_archived
            });
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro na busca de tickets:', error);
    }

    // 4. Simular criação de ticket com dados reais
    console.log('🔍 4. SIMULANDO CRIAÇÃO DE TICKET...');
    try {
      const testData = {
        clientId,
        chatId: '5547996451886@c.us',
        instanceId: clientId,
        customerName: 'Teste Debug',
        customerPhone: '5547996451886',
        lastMessage: 'Mensagem de teste para verificar criação de ticket',
        lastMessageAt: new Date().toISOString()
      };
      
      console.log('🧪 Dados de teste para ticket:', testData);
      
      const ticketId = await ticketsService.ensureTicketExists(
        testData.clientId,
        testData.chatId,
        testData.instanceId,
        testData.customerName,
        testData.customerPhone,
        testData.lastMessage,
        testData.lastMessageAt
      );
      
      console.log('✅ Ticket de teste criado/atualizado:', ticketId);
      
      // Recarregar tickets
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erro ao criar ticket de teste:', error);
    }
    
    console.log('🔍 ===== DEBUG COMPLETO FINALIZADO =====');
  }, [clientId]);

  // FUNÇÃO DE PROCESSAMENTO SIMPLIFICADA E MAIS ROBUSTA
  const processMessage = useCallback(async (message: any) => {
    if (!mountedRef.current || !message) {
      console.log('⚠️ Componente desmontado ou mensagem inválida');
      return;
    }

    console.log('📨 ===== PROCESSANDO NOVA MENSAGEM =====');
    console.log('📨 Message ID:', message.id);
    console.log('📨 From:', message.from);
    console.log('📨 Chat ID:', message.chatId || message.from);
    console.log('📨 From Me:', message.fromMe);
    console.log('📨 Body:', message.body?.substring(0, 100));
    console.log('📨 Timestamp:', message.timestamp);
    console.log('📨 Dados completos da mensagem:', message);

    try {
      // Determinar chat_id - ACEITAR QUALQUER FORMATO
      const chatId = message.chatId || message.from || message.chat_id;
      
      if (!chatId) {
        console.error('❌ Nenhum Chat ID encontrado na mensagem');
        return;
      }

      console.log('✅ Chat ID determinado:', chatId);

      // Extrair telefone - MÉTODO MAIS FLEXÍVEL
      let customerPhone = '';
      if (chatId.includes('@')) {
        customerPhone = chatId.split('@')[0].replace(/\D/g, '');
      } else {
        customerPhone = chatId.replace(/\D/g, '');
      }

      // Determinar nome do cliente - MÚLTIPLAS FONTES
      let customerName = 'Contato';
      if (message.notifyName && message.notifyName !== customerPhone) {
        customerName = message.notifyName;
      } else if (message.pushName && message.pushName !== customerPhone) {
        customerName = message.pushName;
      } else if (message.sender && message.sender !== customerPhone) {
        customerName = message.sender;
      } else if (customerPhone && customerPhone.length >= 10) {
        // Formatar telefone como nome se não tiver nome
        const formattedPhone = customerPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
        customerName = formattedPhone;
      }

      console.log('👤 Dados do cliente determinados:', {
        customerPhone,
        customerName,
        chatId
      });

      // Conteúdo da mensagem
      const messageContent = message.body || message.caption || message.text || '[Mídia]';
      
      console.log('💬 Conteúdo da mensagem:', messageContent);

      // SEMPRE tentar criar/atualizar ticket - SEM VERIFICAÇÕES RESTRITIVAS
      console.log('🎫 Criando/atualizando ticket...');
      const ticketId = await ticketsService.ensureTicketExists(
        clientId,
        chatId,
        clientId, // instance_id = client_id
        customerName,
        customerPhone,
        messageContent,
        new Date(message.timestamp || Date.now()).toISOString()
      );

      console.log('✅ Ticket criado/atualizado:', ticketId);

      // Adicionar mensagem ao ticket
      console.log('💬 Adicionando mensagem ao ticket...');
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
        media_url: message.mediaUrl || message.media_url || null
      });

      console.log('✅ Mensagem adicionada ao ticket com sucesso');

      // Recarregar tickets após um delay
      console.log('🔄 Programando recarga de tickets...');
      setTimeout(() => {
        if (mountedRef.current) {
          console.log('🔄 Executando recarga de tickets...');
          loadTickets();
        }
      }, 1500);
      
    } catch (error) {
      console.error('❌ ERRO CRÍTICO ao processar mensagem:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
      console.error('❌ Dados da mensagem que falhou:', message);
    }
  }, [clientId]);

  const processBatchWithAssistant = useCallback(async (chatId: string, messages: any[]) => {
    console.log(`📦 Processando lote de ${messages.length} mensagens para ${chatId}`);
    
    for (const message of messages) {
      await processMessage(message);
    }
  }, [processMessage]);

  const { addMessage } = useMessageBatch(processBatchWithAssistant);

  // Carregar tickets
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
        console.log('📊 Tickets atualizados no estado:', ticketsData.length);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // Configurar listeners
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 ===== INICIALIZANDO SISTEMA REALTIME =====');
    console.log('🔌 Client ID:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    loadTickets();

    // Conectar WebSocket - MÚLTIPLOS LISTENERS
    console.log('🔌 Conectando WebSocket...');
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado, ID:', socket.id);
      whatsappService.joinClientRoom(clientId);
      console.log('✅ Joinado na sala do cliente:', clientId);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
    });

    socket.on('error', (error: any) => {
      console.error('❌ Erro no WebSocket:', error);
    });

    // TODOS OS EVENTOS POSSÍVEIS DE MENSAGEM
    const messageEvents = [
      `message_${clientId}`,
      `new_message_${clientId}`,
      `whatsapp_message_${clientId}`,
      `incoming_message_${clientId}`,
      'message',
      'new_message',
      'message_received',
      'incoming_message',
      'whatsapp_message',
      'message_create',
      'message_upsert'
    ];

    const handleNewMessage = async (message: any) => {
      console.log('📨 ===== EVENTO DE MENSAGEM CAPTURADO VIA WEBSOCKET =====');
      console.log('📨 Dados recebidos:', message);
      
      if (!mountedRef.current) {
        console.log('⚠️ Componente desmontado, ignorando mensagem');
        return;
      }
      
      // Processar imediatamente
      await processMessage(message);
    };

    // Registrar TODOS os eventos
    messageEvents.forEach(event => {
      console.log(`🎧 Registrando listener para evento: ${event}`);
      socket.on(event, handleNewMessage);
    });

    // Canal do Supabase para mudanças diretas no banco
    console.log('🔌 Configurando canal Supabase Realtime...');
    const channel = supabase
      .channel(`tickets-realtime-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          console.log('📊 Mudança em ticket via Supabase:', payload);
          if (mountedRef.current) {
            setTimeout(loadTickets, 500);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `instance_id=eq.${clientId}`
        },
        async (payload) => {
          console.log('📨 ===== NOVA MENSAGEM NO BANCO (via Supabase Realtime) =====');
          console.log('📨 Payload completo:', payload);
          
          if (payload.new && mountedRef.current) {
            // Converter dados do banco para formato de mensagem
            const message = {
              id: payload.new.id,
              from: payload.new.chat_id,
              chatId: payload.new.chat_id,
              fromMe: payload.new.from_me,
              body: payload.new.body,
              type: payload.new.message_type,
              timestamp: payload.new.timestamp,
              sender: payload.new.sender,
              notifyName: payload.new.sender,
              pushName: payload.new.sender
            };
            
            console.log('📨 Mensagem convertida do banco:', message);
            await processMessage(message);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal Supabase:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('🔌 ===== LIMPANDO RECURSOS =====');
      mountedRef.current = false;
      initializationRef.current = false;
      
      if (socketRef.current) {
        messageEvents.forEach(event => {
          socketRef.current.off(event, handleNewMessage);
        });
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
      console.log('🔄 Recarregando tickets manualmente...');
      loadTickets();
    }
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline,
    reloadTickets,
    debugMessages: comprehensiveDebug
  };
};
