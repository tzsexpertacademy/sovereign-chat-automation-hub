
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { aiConfigService } from '@/services/aiConfigService';
import { useMessageBatch } from './useMessageBatch';
import { useHumanizedResponse } from './useHumanizedResponse';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const lastMessageIdRef = useRef<string>('');
  const socketRef = useRef<any>(null);

  // Hook para humanização das respostas
  const { sendHumanizedResponse } = useHumanizedResponse({ clientId });

  // Carregar tickets iniciais
  const loadTickets = async () => {
    if (isLoadingRef.current || !clientId) return;
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      console.log('🔄 Carregando tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets carregados:', ticketsData.length);
      
      setTickets(ticketsData);
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Função para extrair nome real do WhatsApp
  const extractWhatsAppName = (message: any) => {
    console.log('🔍 Extraindo nome da mensagem:', {
      notifyName: message.notifyName,
      pushName: message.pushName,
      senderName: message.senderName,
      author: message.author,
      from: message.from
    });

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
        console.log('✅ Nome extraído:', name.trim());
        return name.trim();
      }
    }

    const phone = message.from?.replace(/\D/g, '') || '';
    if (phone.length >= 10) {
      const formattedPhone = phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      console.log('📞 Usando telefone formatado:', formattedPhone);
      return formattedPhone;
    }

    console.log('⚠️ Nenhum nome válido encontrado, usando padrão');
    return `Contato ${phone || 'Desconhecido'}`;
  };

  // Processar batch de mensagens com assistente automático
  const processBatchWithAssistant = async (messages: any[], ticketId: string, chatId: string) => {
    try {
      console.log('🤖 Iniciando processamento do batch:', messages.length, 'mensagens');
      
      // Buscar configurações do cliente
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig) {
        console.log('⚠️ Nenhuma configuração de IA encontrada para cliente:', clientId);
        return;
      }

      console.log('🔍 Configuração IA encontrada:', aiConfig.default_model);

      // Buscar fila ativa conectada à instância
      const activeQueue = queues.find(queue => 
        queue.is_active && 
        queue.assistants && 
        queue.assistants.is_active &&
        queue.instance_queue_connections?.some(conn => 
          conn.instance_id && conn.is_active
        )
      );

      if (!activeQueue || !activeQueue.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        return;
      }

      const assistant = activeQueue.assistants;
      console.log('🤖 Processando com assistente:', assistant.name, 'Modelo:', assistant.model);

      // Preparar configurações avançadas
      let advancedSettings = {
        temperature: 0.7,
        max_tokens: 1000
      };
      
      try {
        if (assistant.advanced_settings) {
          const parsedSettings = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;
          
          advancedSettings = {
            temperature: Number(parsedSettings.temperature) || 0.7,
            max_tokens: Number(parsedSettings.max_tokens) || 1000
          };
        }
      } catch (error) {
        console.error('❌ Erro ao parse das configurações avançadas:', error);
      }

      // Buscar histórico de mensagens do ticket para contexto (40 mensagens)
      console.log('📚 Buscando histórico de mensagens para contexto...');
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      console.log(`📨 ${ticketMessages.length} mensagens encontradas no histórico`);
      
      const recentMessages = ticketMessages
        .slice(-40) // Últimas 40 mensagens para contexto expandido
        .map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content || ''
        }));

      // Adicionar mensagens do batch atual ao contexto
      const batchMessages = messages.map(msg => ({
        role: 'user' as const,
        content: msg.content || ''
      }));

      const allMessages = [...recentMessages, ...batchMessages];
      console.log(`🔄 Enviando para OpenAI com ${allMessages.length} mensagens de contexto`);

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
              content: assistant.prompt || 'Você é um assistente útil.'
            },
            ...allMessages
          ],
          temperature: advancedSettings.temperature,
          max_tokens: advancedSettings.max_tokens,
        }),
      });

      console.log('📡 Resposta da OpenAI:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse && assistantResponse.trim()) {
        console.log('🤖 Resposta do assistente gerada:', assistantResponse.substring(0, 100) + '...');
        
        // Verificar se deve enviar áudio
        const shouldSendAudio = assistantResponse.toLowerCase().includes('audio:');
        
        // Enviar resposta humanizada com delay e indicadores
        await sendHumanizedResponse(chatId, assistantResponse, shouldSendAudio);
        
        // Registrar a resposta no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_${Date.now()}`,
          from_me: true,
          sender_name: assistant.name,
          content: assistantResponse,
          message_type: shouldSendAudio ? 'audio' : 'text',
          is_internal_note: false,
          is_ai_response: true,
          ai_confidence_score: data.choices?.[0]?.finish_reason === 'stop' ? 0.9 : 0.7,
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta automática enviada e registrada com humanização');
        
        // Recarregar tickets para mostrar a nova mensagem
        setTimeout(() => {
          if (!isLoadingRef.current) {
            loadTickets();
          }
        }, 1000);
        
      } else {
        console.log('⚠️ Assistente não gerou resposta válida');
      }

    } catch (error) {
      console.error('❌ Erro ao processar batch com assistente:', error);
      
      // Registrar erro no ticket
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: `error_${Date.now()}`,
        from_me: true,
        sender_name: 'Sistema',
        content: 'Erro no processamento automático. Um atendente será notificado.',
        message_type: 'text',
        is_internal_note: true,
        is_ai_response: false,
        processing_status: 'failed',
        timestamp: new Date().toISOString()
      });
    }
  };

  // Hook para batching de mensagens (5 segundos de timeout)
  const { addMessage: addToBatch } = useMessageBatch({
    batchTimeoutSeconds: 5,
    onProcessBatch: async (batchedMessages) => {
      console.log('📦 Processando batch de mensagens:', batchedMessages.length);
      
      if (batchedMessages.length === 0) return;
      
      // Pegar a última mensagem para extrair informações do ticket
      const lastMessage = batchedMessages[batchedMessages.length - 1];
      const chatId = lastMessage.from;
      
      try {
        // Buscar o ticket correspondente
        const allTickets = await ticketsService.getClientTickets(clientId);
        const ticket = allTickets.find(t => t.chat_id === chatId);
        
        if (ticket) {
          await processBatchWithAssistant(batchedMessages, ticket.id, chatId);
        } else {
          console.log('⚠️ Ticket não encontrado para o chat:', chatId);
        }
      } catch (error) {
        console.error('❌ Erro ao processar batch:', error);
      }
    }
  });

  // Configurar listeners para atualizações em tempo real
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 Configurando listeners de tempo real para cliente:', clientId);

    // Carregar tickets iniciais apenas uma vez
    loadTickets();

    // Conectar ao WebSocket do WhatsApp
    console.log('🔌 Conectando ao WebSocket...');
    const socket = whatsappService.connectSocket();
    socketRef.current = socket;
    
    // Garantir que entramos no room do cliente
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado, entrando no room do cliente...');
      whatsappService.joinClientRoom(clientId);
    });

    // Se já estiver conectado, entrar no room imediatamente
    if (socket.connected) {
      whatsappService.joinClientRoom(clientId);
    }

    // Listener para novas mensagens do WhatsApp via WebSocket
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida via WebSocket:', {
        id: message.id,
        from: message.from,
        body: message.body?.substring(0, 50),
        fromMe: message.fromMe,
        timestamp: message.timestamp,
        type: message.type || 'text'
      });
      
      // Evitar processar a mesma mensagem duas vezes
      if (lastMessageIdRef.current === message.id) {
        console.log('⏭️ Mensagem já processada, ignorando');
        return;
      }
      lastMessageIdRef.current = message.id;
      
      // Ignorar mensagens próprias
      if (message.fromMe) {
        console.log('⏭️ Ignorando mensagem própria');
        return;
      }
      
      try {
        const customerName = extractWhatsAppName(message);
        const customerPhone = message.from?.replace(/\D/g, '') || '';
        
        console.log('👤 Dados do cliente:', { customerName, customerPhone });
        
        // Criar/atualizar ticket imediatamente
        console.log('🎯 Criando/atualizando ticket...');
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from || message.chatId,
          clientId,
          customerName,
          customerPhone,
          message.body || '',
          new Date().toISOString()
        );

        console.log('✅ Ticket criado/atualizado:', ticketId);

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

        console.log('📝 Mensagem adicionada ao ticket');

        // Atualizar lista de tickets IMEDIATAMENTE
        console.log('🔄 Recarregando tickets...');
        await loadTickets();

        // Adicionar mensagem ao batch para processamento inteligente
        console.log('📦 Adicionando mensagem ao batch para processamento...');
        addToBatch({
          id: message.id,
          content: message.body || '',
          timestamp: new Date(message.timestamp || Date.now()).toISOString(),
          from: message.from || message.chatId,
          type: message.type || 'text'
        });
        
      } catch (error) {
        console.error('❌ Erro ao processar nova mensagem:', error);
      }
    };

    // Conectar listener para mensagens específicas do cliente
    const messageEvent = `message_${clientId}`;
    socket.on(messageEvent, handleNewWhatsAppMessage);
    console.log(`🎧 Listener configurado para evento: ${messageEvent}`);

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
          // Recarregar tickets após mudanças
          setTimeout(() => {
            if (!isLoadingRef.current) {
              loadTickets();
            }
          }, 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages'
        },
        async (payload) => {
          console.log('💬 Nova mensagem de ticket via Supabase');
          // Atualizar tickets para mostrar nova mensagem
          setTimeout(() => {
            if (!isLoadingRef.current) {
              loadTickets();
            }
          }, 500);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 Limpando listeners...');
      if (socketRef.current) {
        socketRef.current.off(messageEvent, handleNewWhatsAppMessage);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clientId, addToBatch, sendHumanizedResponse]);

  return {
    tickets,
    isLoading,
    reloadTickets: loadTickets
  };
};
