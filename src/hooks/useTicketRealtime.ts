
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { aiConfigService } from '@/services/aiConfigService';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const initializationRef = useRef(false);

  console.log('🔄 useTicketRealtime hook inicializado para cliente:', clientId);

  // Buscar instância ativa
  useEffect(() => {
    const findActiveInstance = async () => {
      try {
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('instance_id')
          .eq('client_id', clientId)
          .eq('status', 'connected')
          .limit(1);

        if (instances && instances.length > 0) {
          setInstanceId(instances[0].instance_id);
          console.log('📱 Instância ativa encontrada:', instances[0].instance_id);
        } else {
          console.log('⚠️ Nenhuma instância ativa encontrada, usando clientId como fallback');
          setInstanceId(clientId);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar instâncias:', error);
        setInstanceId(clientId);
      }
    };

    if (clientId) {
      findActiveInstance();
    }
  }, [clientId]);

  // Carregar tickets
  const loadTickets = useCallback(async () => {
    if (!clientId || !mountedRef.current) return;
    
    try {
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

  // Processar com assistente IA - SUPER SIMPLIFICADO
  const processWithAssistant = useCallback(async (message: any, ticketId: string) => {
    console.log(`🤖 PROCESSAMENTO IA INICIADO - Ticket: ${ticketId}`);
    console.log(`📨 Mensagem recebida:`, message.body?.substring(0, 100));
    
    if (!mountedRef.current || !ticketId || !instanceId) {
      console.log('❌ Condições não atendidas para processamento');
      return;
    }
    
    try {
      setAssistantTyping(true);
      console.log('⌨️ Assistente iniciou digitação');
      
      // Simular tempo de digitação
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      // Buscar configurações básicas
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('⚠️ Sem configuração de IA - usando resposta padrão');
        const defaultResponse = "Olá! Obrigado pela sua mensagem. Nossa equipe entrará em contato em breve.";
        await sendAssistantResponse(defaultResponse, ticketId, message.from);
        return;
      }

      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('⚠️ Sem fila ativa - usando resposta padrão');
        const defaultResponse = "Obrigado pelo contato! Em breve retornaremos sua mensagem.";
        await sendAssistantResponse(defaultResponse, ticketId, message.from);
        return;
      }

      const assistant = activeQueue.assistants;
      console.log(`🤖 Usando assistente: ${assistant.name}`);

      // Chamar OpenAI
      const systemPrompt = assistant.prompt || 'Você é um assistente útil. Responda de forma amigável e concisa.';
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.body || 'Mensagem recebida' }
      ];

      console.log('🚀 Enviando para OpenAI...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        console.error('❌ Erro da OpenAI:', response.status);
        const fallbackResponse = "Desculpe, estou com dificuldades técnicas no momento. Nossa equipe entrará em contato.";
        await sendAssistantResponse(fallbackResponse, ticketId, message.from);
        return;
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
      
      console.log(`🤖 Resposta da IA: ${assistantResponse.substring(0, 100)}...`);
      await sendAssistantResponse(assistantResponse, ticketId, message.from);

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      const errorResponse = "Obrigado pela mensagem! Nossa equipe analisará e retornará em breve.";
      await sendAssistantResponse(errorResponse, ticketId, message.from);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
        console.log('⌨️ Assistente parou de digitar');
      }
    }
  }, [clientId, instanceId]);

  // Enviar resposta do assistente
  const sendAssistantResponse = async (response: string, ticketId: string, chatId: string) => {
    try {
      console.log('📤 Enviando resposta do assistente...');
      
      // Enviar via WhatsApp
      const sendResult = await whatsappService.sendMessage(instanceId!, chatId, response);
      console.log('📤 Resultado do envio:', sendResult);
      
      // Registrar no ticket
      const messageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: messageId,
        from_me: true,
        sender_name: '🤖 Assistente IA',
        content: response,
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: true,
        ai_confidence_score: 0.9,
        processing_status: 'completed',
        timestamp: new Date().toISOString()
      });

      console.log('✅ Resposta enviada e registrada com sucesso');
      
      // Recarregar tickets
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Erro ao enviar resposta:', error);
    }
  };

  // Processar mensagem recebida - SUPER SIMPLIFICADO
  const processMessage = useCallback(async (message: any) => {
    if (!mountedRef.current || !message || processedMessagesRef.current.has(message.id)) {
      return;
    }
    
    processedMessagesRef.current.add(message.id);
    console.log('📨 NOVA MENSAGEM RECEBIDA:', {
      id: message.id,
      from: message.from,
      body: message.body?.substring(0, 50),
      fromMe: message.fromMe
    });
    
    // Se for nossa mensagem, apenas recarregar
    if (message.fromMe) {
      console.log('📤 Mensagem nossa - apenas recarregando tickets');
      setTimeout(loadTickets, 1000);
      return;
    }
    
    try {
      // Normalizar dados da mensagem
      let chatId = message.from || message.chatId;
      let phoneNumber = chatId?.split('@')[0] || chatId;
      let customerName = message.notifyName || message.pushName || phoneNumber;
      let content = message.body || message.caption || 'Mensagem recebida';
      
      console.log('👤 Processando mensagem do cliente:', customerName);
      
      // Criar/atualizar ticket
      const ticketId = await ticketsService.createOrUpdateTicket(
        clientId,
        chatId,
        instanceId || clientId,
        customerName,
        phoneNumber,
        content,
        new Date().toISOString()
      );

      console.log('🎫 Ticket criado/atualizado:', ticketId);

      // Salvar mensagem
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: message.id,
        from_me: false,
        sender_name: customerName,
        content: content,
        message_type: message.type || 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received',
        timestamp: new Date().toISOString()
      });

      console.log('💾 Mensagem salva no ticket');

      // Recarregar tickets
      setTimeout(loadTickets, 500);

      // PROCESSAR COM ASSISTENTE SEMPRE
      console.log('🤖 INICIANDO processamento com IA...');
      setTimeout(() => {
        if (mountedRef.current) {
          processWithAssistant(message, ticketId);
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }, [clientId, instanceId, loadTickets, processWithAssistant]);

  // Configurar listeners - SIMPLIFICADO
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Inicializando conexões para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    // Carregar tickets inicial
    loadTickets();

    try {
      // Socket para mensagens
      const socket = whatsappService.connectSocket();
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ WebSocket conectado');
        whatsappService.joinClientRoom(clientId);
      });

      socket.on('disconnect', (reason: any) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      // Escutar TODAS as mensagens possíveis
      const messageEvents = [
        `message_${clientId}`,
        `new_message_${clientId}`,
        `whatsapp_message_${clientId}`,
        'message',
        'new_message',
        'whatsapp_message'
      ];

      messageEvents.forEach(eventName => {
        socket.on(eventName, (message: any) => {
          console.log(`📨 Evento recebido [${eventName}]:`, {
            id: message.id,
            from: message.from,
            body: message.body?.substring(0, 30),
            fromMe: message.fromMe
          });
          
          if (mountedRef.current) {
            processMessage(message);
          }
        });
      });

      // Canal Supabase para mudanças
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
            console.log('🔄 Mudança no banco:', payload.eventType);
            if (mountedRef.current) {
              setTimeout(loadTickets, 500);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

    } catch (error) {
      console.error('❌ Erro ao inicializar:', error);
    }

    return () => {
      console.log('🧹 Limpando recursos...');
      mountedRef.current = false;
      initializationRef.current = false;
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      processedMessagesRef.current.clear();
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
    isOnline: true, // Sempre online para simplificar
    reloadTickets
  };
};
