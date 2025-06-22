
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

  // NOVA FUNÇÃO DE DEBUG MUITO MAIS DETALHADA
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
    
    // 2. Verificar mensagens no banco
    console.log('🔍 2. VERIFICANDO MENSAGENS NO BANCO...');
    try {
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('instance_id', clientId)
        .order('timestamp', { ascending: false })
        .limit(5);

      if (error) {
        console.error('❌ Erro ao buscar mensagens:', error);
      } else {
        console.log('📊 Últimas 5 mensagens no banco:', messages);
        if (messages && messages.length > 0) {
          console.log('📊 Mensagem mais recente:', {
            id: messages[0].id,
            chat_id: messages[0].chat_id,
            body: messages[0].body?.substring(0, 50),
            timestamp: messages[0].timestamp,
            from_me: messages[0].from_me
          });
        } else {
          console.log('⚠️ NENHUMA MENSAGEM ENCONTRADA NO BANCO!');
        }
      }
    } catch (error) {
      console.error('❌ Erro na busca de mensagens:', error);
    }

    // 3. Verificar instâncias ativas
    console.log('🔍 3. VERIFICANDO INSTÂNCIAS...');
    try {
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('client_id', clientId);

      if (error) {
        console.error('❌ Erro ao buscar instâncias:', error);
      } else {
        console.log('📊 Instâncias encontradas:', instances);
      }
    } catch (error) {
      console.error('❌ Erro na busca de instâncias:', error);
    }

    // 4. Testar conexão direta com WhatsApp server
    console.log('🔍 4. TESTANDO CONEXÃO COM SERVIDOR WHATSAPP...');
    try {
      // Tentar fazer uma chamada de teste para o servidor WhatsApp
      const response = await fetch(`http://localhost:3001/api/instance/${clientId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Servidor WhatsApp respondeu:', data);
      } else {
        console.log('⚠️ Servidor WhatsApp retornou erro:', response.status, response.statusText);
      }
    } catch (error) {
      console.log('❌ Não foi possível conectar ao servidor WhatsApp:', error);
      console.log('⚠️ Isso pode indicar que o servidor WhatsApp não está rodando ou não está acessível');
    }

    // 5. Verificar Supabase Realtime
    console.log('🔍 5. VERIFICANDO SUPABASE REALTIME...');
    if (channelRef.current) {
      console.log('✅ Canal Supabase existe:', channelRef.current.topic);
    } else {
      console.log('❌ Canal Supabase não existe!');
    }

    // 6. Forçar teste de mensagem
    console.log('🔍 6. FORÇANDO TESTE DE PROCESSAMENTO...');
    const testMessage = {
      id: `test_${Date.now()}`,
      from: '5547996451886@c.us',
      chatId: '5547996451886@c.us',
      fromMe: false,
      body: 'Mensagem de teste do debug',
      timestamp: Date.now(),
      type: 'text'
    };
    
    console.log('🧪 Processando mensagem de teste:', testMessage);
    await processMessage(testMessage);
    
    console.log('🔍 ===== DEBUG COMPLETO FINALIZADO =====');
  }, [clientId]);

  // Processar mensagem individualmente - SIMPLIFICADO
  const processMessage = useCallback(async (message: any) => {
    if (!mountedRef.current || !message) {
      console.log('⚠️ Componente desmontado ou mensagem inválida');
      return;
    }

    console.log('📨 ===== PROCESSANDO MENSAGEM =====');
    console.log('📨 Message ID:', message.id);
    console.log('📨 From:', message.from);
    console.log('📨 Chat ID:', message.chatId || message.from);
    console.log('📨 From Me:', message.fromMe);
    console.log('📨 Body:', message.body?.substring(0, 100));
    console.log('📨 Timestamp:', message.timestamp);
    console.log('📨 Mensagem completa:', message);

    try {
      const chatId = message.chatId || message.from;
      
      if (!chatId) {
        console.error('❌ Chat ID não encontrado na mensagem');
        return;
      }

      const customerPhone = chatId.replace(/\D/g, '');
      const customerName = message.notifyName || 
                         message.pushName || 
                         message.sender ||
                         (customerPhone ? customerPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : null) ||
                         'Contato';

      console.log('🎫 Dados para ticket:', {
        clientId,
        chatId,
        customerPhone,
        customerName
      });

      // SEMPRE criar/atualizar ticket
      console.log('🎫 Criando/atualizando ticket...');
      const ticketId = await ticketsService.ensureTicketExists(
        clientId,
        chatId,
        clientId, // instance_id
        customerName,
        customerPhone,
        message.body || message.caption || '[Mídia]',
        new Date(message.timestamp || Date.now()).toISOString()
      );

      console.log('✅ Ticket processado:', ticketId);

      // Adicionar mensagem ao ticket
      console.log('💬 Adicionando mensagem ao ticket...');
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: message.id,
        from_me: message.fromMe,
        sender_name: message.author || customerName,
        content: message.body || message.caption || '[Mídia]',
        message_type: message.type || 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received',
        timestamp: new Date(message.timestamp || Date.now()).toISOString(),
        media_url: message.mediaUrl || null
      });

      console.log('✅ Mensagem adicionada ao ticket');

      // Recarregar tickets
      console.log('🔄 Recarregando tickets...');
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      console.error('❌ Stack:', error instanceof Error ? error.stack : 'N/A');
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
    if (!clientId || !mountedRef.current || (now - lastLoadTimeRef.current) < 2000) {
      return;
    }
    
    try {
      lastLoadTimeRef.current = now;
      setIsLoading(true);
      console.log('🔄 Carregando tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets carregados:', ticketsData.length);
      console.log('📊 Tickets:', ticketsData);
      
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

  // Configurar listeners
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 ===== INICIALIZANDO SISTEMA =====');
    console.log('🔌 Client ID:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    loadTickets();

    // Conectar WebSocket
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

    // MÚLTIPLOS LISTENERS para garantir captura
    const messageEvents = [
      `message_${clientId}`,
      `new_message_${clientId}`,
      `whatsapp_message_${clientId}`,
      'message',
      'new_message',
      'message_received',
      'incoming_message'
    ];

    const handleNewMessage = async (message: any) => {
      console.log('📨 ===== EVENTO DE MENSAGEM CAPTURADO =====');
      console.log('📨 Evento recebido via WebSocket');
      console.log('📨 Message ID:', message.id);
      console.log('📨 From:', message.from);
      console.log('📨 Body:', message.body?.substring(0, 50));
      console.log('📨 Dados completos:', message);
      
      if (!mountedRef.current) {
        console.log('⚠️ Componente desmontado, ignorando mensagem');
        return;
      }
      
      await processMessage(message);
    };

    // Registrar todos os eventos
    messageEvents.forEach(event => {
      console.log(`🎧 Registrando listener para evento: ${event}`);
      socket.on(event, handleNewMessage);
    });

    // Canal do Supabase para atualizações em tempo real
    console.log('🔌 Configurando canal Supabase...');
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
          console.log('📨 ===== NOVA MENSAGEM NO BANCO (via Supabase) =====');
          console.log('📨 Payload:', payload);
          
          if (payload.new && mountedRef.current) {
            // Converter formato do banco para formato esperado
            const message = {
              id: payload.new.id,
              from: payload.new.chat_id,
              chatId: payload.new.chat_id,
              fromMe: payload.new.from_me,
              body: payload.new.body,
              type: payload.new.message_type,
              timestamp: payload.new.timestamp,
              caption: payload.new.caption,
              mediaUrl: payload.new.media_url,
              sender: payload.new.sender,
              pushName: payload.new.push_name,
              notifyName: payload.new.notify_name
            };
            
            console.log('📨 Mensagem convertida:', message);
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
      loadTickets();
    }
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline,
    reloadTickets,
    debugMessages: comprehensiveDebug // Função de debug melhorada
  };
};
