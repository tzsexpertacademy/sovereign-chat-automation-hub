
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { assistantsService } from '@/services/assistantsService';
import { aiConfigService } from '@/services/aiConfigService';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const isLoadingRef = useRef(false);

  // Carregar tickets iniciais
  const loadTickets = async () => {
    if (isLoadingRef.current || !clientId) return;
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      console.log('🔄 Carregando tickets...');
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets carregados:', ticketsData);
      
      setTickets(ticketsData);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Função para extrair nome real do WhatsApp
  const extractWhatsAppName = (message: any) => {
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
      return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }

    return null;
  };

  // Processar mensagem com assistente automático
  const processMessageWithAssistant = async (message: any, ticketId: string) => {
    try {
      console.log('🤖 Iniciando processamento automático da mensagem:', message.id);
      
      // Buscar configurações do cliente
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig) {
        console.log('⚠️ Nenhuma configuração de IA encontrada');
        return;
      }

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
      console.log('🤖 Processando com assistente:', assistant.name);

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
            temperature: parsedSettings.temperature || 0.7,
            max_tokens: parsedSettings.max_tokens || 1000
          };
        }
      } catch (error) {
        console.error('Erro ao parse das configurações avançadas:', error);
      }

      // Buscar histórico de mensagens do ticket para contexto
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      const recentMessages = ticketMessages
        .slice(-10) // Últimas 10 mensagens para contexto
        .map(msg => ({
          role: msg.from_me ? 'assistant' : 'user',
          content: msg.content || ''
        }));

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
            ...recentMessages,
            {
              role: 'user',
              content: message.body || ''
            }
          ],
          temperature: advancedSettings.temperature,
          max_tokens: advancedSettings.max_tokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro da API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse && assistantResponse.trim()) {
        console.log('🤖 Resposta do assistente gerada:', assistantResponse.substring(0, 100));
        
        // Enviar resposta via WhatsApp
        await whatsappService.sendMessage(clientId, message.from, assistantResponse);
        
        // Registrar a resposta no ticket
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: `ai_${Date.now()}`,
          from_me: true,
          sender_name: assistant.name,
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
      console.error('❌ Erro ao processar mensagem com assistente:', error);
      
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

  // Configurar listeners para atualizações em tempo real
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 Configurando listeners de tempo real para:', clientId);

    // Carregar tickets iniciais apenas uma vez
    loadTickets();

    // Listener para novas mensagens do WhatsApp via WebSocket
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida:', message);
      
      // Ignorar mensagens próprias
      if (message.fromMe) {
        console.log('⏭️ Ignorando mensagem própria');
        return;
      }
      
      try {
        const customerName = extractWhatsAppName(message) || `Contato ${message.from?.replace(/\D/g, '') || ''}`;
        const customerPhone = message.from?.replace(/\D/g, '') || '';
        
        console.log('🔍 Nome extraído:', customerName);
        
        // Criar/atualizar ticket imediatamente
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

        console.log('🎯 Acionando processamento automático...');
        
        // IMPORTANTE: Processar com assistente automático
        setTimeout(() => {
          processMessageWithAssistant(message, ticketId);
        }, 1000); // Pequeno delay para garantir que a mensagem foi salva

        // Atualizar tickets sem recarregar tudo
        console.log('📋 Atualizando lista de tickets...');
        setTimeout(() => {
          if (!isLoadingRef.current) {
            loadTickets();
          }
        }, 500);
        
      } catch (error) {
        console.error('Erro ao processar nova mensagem:', error);
      }
    };

    // Conectar ao WebSocket do WhatsApp
    console.log('🔌 Conectando ao WebSocket para tempo real...');
    whatsappService.onClientMessage(clientId, handleNewWhatsAppMessage);

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
          console.log('🔄 Ticket atualizado via Supabase:', payload);
          // Pequeno delay para evitar múltiplas chamadas
          setTimeout(() => {
            if (!isLoadingRef.current) {
              loadTickets();
            }
          }, 1000);
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
          console.log('💬 Nova mensagem de ticket via Supabase:', payload);
          // Atualizar tickets para mostrar nova mensagem
          setTimeout(() => {
            if (!isLoadingRef.current) {
              loadTickets();
            }
          }, 1000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 Desconectando listeners...');
      whatsappService.removeListener(`message_${clientId}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clientId]);

  return {
    tickets,
    isLoading,
    reloadTickets: loadTickets
  };
};
