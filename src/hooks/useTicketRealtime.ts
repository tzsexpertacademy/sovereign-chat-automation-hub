
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';

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

  // Configurar listeners para atualizações em tempo real
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 Configurando listeners de tempo real para:', clientId);

    // Carregar tickets iniciais apenas uma vez
    loadTickets();

    // Listener para novas mensagens do WhatsApp via WebSocket
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida:', message);
      
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
