
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
  const [isOnline, setIsOnline] = useState(true); // Sempre online por padrão
  
  const mountedRef = useRef(true);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const processingRef = useRef<Set<string>>(new Set());

  // Carregar tickets - versão simplificada
  const loadTickets = useCallback(async () => {
    if (!clientId || !mountedRef.current || isLoading) {
      return;
    }
    
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
  }, [clientId, isLoading]);

  // Processar com assistente - versão simplificada
  const processWithAssistant = useCallback(async (message: any, ticketId: string) => {
    if (!mountedRef.current || processingRef.current.has(ticketId)) {
      return;
    }
    
    processingRef.current.add(ticketId);
    console.log(`🤖 Processando com assistente - Ticket: ${ticketId}`);
    
    try {
      setAssistantTyping(true);
      
      // Simular processamento (3-5 segundos)
      await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
      
      if (!mountedRef.current) return;
      
      // Buscar configurações
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
      
      // Processar com OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: assistant.prompt || 'Você é um assistente útil.'
            },
            { 
              role: 'user', 
              content: message.body || 'Mensagem recebida' 
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro da OpenAI: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 Resposta da IA:`, assistantResponse.substring(0, 100));
        
        // Enviar via WhatsApp
        const instanceId = clientId; // Usar clientId como instanceId
        const sendResult = await whatsappService.sendMessage(instanceId, message.from, assistantResponse);
        console.log(`📤 Resultado do envio:`, sendResult);
        
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
          processing_status: 'completed',
          timestamp: new Date().toISOString()
        });

        console.log('✅ Resposta enviada e registrada');
        
        // Recarregar tickets
        setTimeout(() => {
          if (mountedRef.current) {
            loadTickets();
          }
        }, 2000);
      }

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
      }
      processingRef.current.delete(ticketId);
    }
  }, [clientId, loadTickets]);

  // Processar mensagem recebida
  const processMessage = useCallback(async (message: any) => {
    if (!mountedRef.current || !message || processedMessagesRef.current.has(message.id)) {
      return;
    }
    
    processedMessagesRef.current.add(message.id);
    console.log('📨 Nova mensagem do WhatsApp:', {
      id: message.id,
      from: message.from,
      body: message.body?.substring(0, 50),
      fromMe: message.fromMe
    });
    
    // Se for nossa mensagem, apenas recarregar
    if (message.fromMe) {
      setTimeout(loadTickets, 1000);
      return;
    }
    
    try {
      // Criar/atualizar ticket
      const ticketId = await ticketsService.createOrUpdateTicket(
        clientId,
        message.from,
        clientId,
        message.notifyName || message.from,
        message.from,
        message.body || '',
        new Date().toISOString()
      );

      console.log('🎫 Ticket criado/atualizado:', ticketId);

      // Salvar mensagem
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: message.id,
        from_me: false,
        sender_name: message.notifyName || 'Cliente',
        content: message.body || '',
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received',
        timestamp: new Date().toISOString()
      });

      // Recarregar tickets
      setTimeout(loadTickets, 1000);

      // Processar com assistente se não estiver processando
      if (!processingRef.current.has(ticketId)) {
        setTimeout(() => {
          if (mountedRef.current) {
            processWithAssistant(message, ticketId);
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }, [clientId, loadTickets, processWithAssistant]);

  // Inicialização - versão simplificada
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 Iniciando sistema para cliente:', clientId);
    mountedRef.current = true;
    setIsOnline(true); // Sempre online

    // Carregar tickets iniciais
    loadTickets();

    // Conectar ao WebSocket
    const socket = whatsappService.connectSocket();
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
      whatsappService.joinClientRoom(clientId);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
    });

    // Eventos de mensagem
    socket.on(`message_${clientId}`, processMessage);
    socket.on('message', processMessage);

    // Canal do Supabase para mudanças nos tickets
    const channel = supabase
      .channel(`tickets-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          console.log('🔄 Nova mudança no banco - tickets');
          if (mountedRef.current) {
            setTimeout(loadTickets, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Limpando recursos...');
      mountedRef.current = false;
      socket.disconnect();
      supabase.removeChannel(channel);
      processedMessagesRef.current.clear();
      processingRef.current.clear();
    };
  }, [clientId, loadTickets, processMessage]);

  const reloadTickets = useCallback(() => {
    if (mountedRef.current && !isLoading) {
      loadTickets();
    }
  }, [loadTickets, isLoading]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline: true, // Sempre retornar true
    reloadTickets
  };
};
