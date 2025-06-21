
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { aiConfigService } from '@/services/aiConfigService';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const initializationRef = useRef(false);
  const mountedRef = useRef(false);

  // Carregar tickets
  const loadTickets = useCallback(async () => {
    if (isLoadingRef.current || !clientId || !mountedRef.current) {
      return;
    }
    
    try {
      isLoadingRef.current = true;
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
      isLoadingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // Processar mensagem com assistente IA - CORRIGIDO
  const processWithAssistant = useCallback(async (message: any, ticketId: string) => {
    const messageKey = `${message.id}_${message.from}_${message.timestamp}`;
    
    if (processedMessagesRef.current.has(message.id) || 
        processedMessagesRef.current.has(messageKey)) {
      console.log('⏭️ Mensagem já processada pelo assistente, ignorando:', message.id);
      return;
    }
    
    processedMessagesRef.current.add(message.id);
    processedMessagesRef.current.add(messageKey);
    
    try {
      console.log('🤖 Processando mensagem com assistente para ticket:', ticketId);
      setAssistantTyping(true);
      
      // Buscar configurações do cliente
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig || !aiConfig.openai_api_key) {
        console.log('⚠️ Nenhuma configuração de IA encontrada para cliente:', clientId);
        setAssistantTyping(false);
        return;
      }

      // Buscar fila ativa com assistente
      const activeQueue = queues.find((queue: any) => 
        queue.is_active && 
        queue.assistants && 
        queue.assistants.is_active
      );

      if (!activeQueue || !activeQueue.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        setAssistantTyping(false);
        return;
      }

      const assistant = activeQueue.assistants;
      console.log('🤖 Processando com assistente:', assistant.name);

      // Buscar histórico de mensagens do ticket
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      const recentMessages = ticketMessages
        .slice(-10)
        .map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content || ''
        }));

      // Delay humanizado antes de responder
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      // Chamar a API da OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || aiConfig.default_model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: assistant.prompt || 'Você é um assistente útil que responde de forma amigável e profissional.'
            },
            ...recentMessages,
            {
              role: 'user',
              content: message.body || message.text || ''
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse && assistantResponse.trim()) {
        console.log('🤖 Resposta do assistente gerada:', assistantResponse.substring(0, 100) + '...');
        
        // Enviar resposta
        await whatsappService.sendMessage(clientId, message.from, assistantResponse);
        
        // Registrar a resposta no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from_me: true,
          sender_name: `🤖 ${assistant.name}`,
          content: assistantResponse,
          message_type: 'text',
          is_internal_note: false,
          is_ai_response: true,
          ai_confidence_score: data.choices?.[0]?.finish_reason === 'stop' ? 0.9 : 0.7,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta automática enviada e registrada');
        
      } else {
        console.log('⚠️ Assistente não gerou resposta válida');
      }

    } catch (error) {
      console.error('❌ Erro ao processar com assistente:', error);
    } finally {
      setAssistantTyping(false);
    }
  }, [clientId]);

  // Extrair nome real do WhatsApp
  const extractWhatsAppName = useCallback((message: any) => {
    const possibleNames = [
      message.notifyName,
      message.pushName, 
      message.senderName,
      message.author,
      message.sender
    ];

    for (const name of possibleNames) {
      if (name && 
          typeof name === 'string' && 
          name.trim() !== '' && 
          !name.includes('@') && 
          name.length > 1) {
        return name.trim();
      }
    }

    const phone = message.from?.replace(/\D/g, '') || '';
    if (phone.length >= 10) {
      const formattedPhone = phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      return formattedPhone;
    }

    return `Contato ${phone || 'Desconhecido'}`;
  }, []);

  // Configurar listeners - CONTROLADO PARA EVITAR LOOPS
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Configurando listeners de tempo real para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    // Carregar tickets inicial
    loadTickets();

    // Conectar ao WebSocket do WhatsApp
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      whatsappService.joinClientRoom(clientId);
      setIsOnline(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
      setIsOnline(false);
    });

    if (socket.connected) {
      whatsappService.joinClientRoom(clientId);
      setIsOnline(true);
    }

    // Listener para novas mensagens do WhatsApp
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida:', {
        id: message.id,
        from: message.from,
        body: message.body?.substring(0, 50),
        fromMe: message.fromMe,
        timestamp: message.timestamp
      });
      
      const messageKey = `${message.id}_${message.from}_${message.timestamp}`;
      
      if (processedMessagesRef.current.has(message.id) || 
          processedMessagesRef.current.has(messageKey)) {
        console.log('⏭️ Mensagem já processada, ignorando:', message.id);
        return;
      }
      
      processedMessagesRef.current.add(message.id);
      processedMessagesRef.current.add(messageKey);
      
      // Ignorar mensagens próprias
      if (message.fromMe) {
        console.log('⏭️ Ignorando mensagem própria');
        return;
      }
      
      try {
        const customerName = extractWhatsAppName(message);
        const customerPhone = message.from?.replace(/\D/g, '') || '';
        
        // Criar/atualizar ticket
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from || message.chatId,
          clientId,
          customerName,
          customerPhone,
          message.body || '',
          new Date().toISOString()
        );

        // Adicionar mensagem ao ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: message.id,
          from_me: message.fromMe || false,
          sender_name: customerName,
          content: message.body || '',
          message_type: message.type || 'text',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'received',
          timestamp: new Date(message.timestamp || Date.now()).toISOString()
        });

        // Recarregar tickets
        setTimeout(() => {
          if (!isLoadingRef.current && mountedRef.current) {
            loadTickets();
          }
        }, 1000);

        // Processar com assistente - CORRIGIDO
        if (!message.type || message.type === 'text' || message.type === 'chat') {
          await processWithAssistant(message, ticketId);
        }
        
      } catch (error) {
        console.error('❌ Erro ao processar nova mensagem:', error);
      }
    };

    const messageEvent = `message_${clientId}`;
    socket.on(messageEvent, handleNewWhatsAppMessage);

    // Listener para atualizações de tickets no Supabase
    const channel = supabase
      .channel(`ticket-updates-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        async (payload) => {
          console.log('🔄 Ticket atualizado via Supabase:', payload.eventType);
          
          setTimeout(() => {
            if (!isLoadingRef.current && mountedRef.current) {
              loadTickets();
            }
          }, 500);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 Limpando listeners...');
      initializationRef.current = false;
      mountedRef.current = false;
      
      if (socketRef.current) {
        socketRef.current.off(messageEvent, handleNewWhatsAppMessage);
        socketRef.current.disconnect();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      processedMessagesRef.current.clear();
      setIsOnline(false);
    };
  }, [clientId]);

  const reloadTickets = useCallback(() => {
    console.log('🔄 Recarregamento manual solicitado');
    if (!isLoadingRef.current && mountedRef.current) {
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
