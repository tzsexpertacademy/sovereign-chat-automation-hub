
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket, type TicketMessage } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);

  // Carregar tickets iniciais
  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const ticketsData = await ticketsService.getClientTickets(clientId);
      setTickets(ticketsData);
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
    } finally {
      setIsLoading(false);
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

    loadTickets();

    // Listener para novas mensagens do WhatsApp via WebSocket
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida em tempo real:', message);
      
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

        // Recarregar tickets instantaneamente para mostrar a nova mensagem
        await loadTickets();
        
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
          await loadTickets();
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
          await loadTickets();
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Atualizar tickets a cada 5 segundos para garantir sincronização
    const intervalId = setInterval(() => {
      loadTickets();
    }, 5000);

    return () => {
      whatsappService.removeListener(`message_${clientId}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      clearInterval(intervalId);
    };
  }, [clientId]);

  return {
    tickets,
    isLoading,
    reloadTickets: loadTickets
  };
};
