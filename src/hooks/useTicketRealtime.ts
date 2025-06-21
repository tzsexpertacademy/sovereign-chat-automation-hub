
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket, type TicketMessage } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);

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
    // Prioridade: notifyName > pushName > senderName > author
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
          !name.includes('@') && // Evitar IDs
          name.length > 1) {
        return name.trim();
      }
    }

    // Se não encontrar nome, usar número formatado
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

    // Listener para novas mensagens do WhatsApp
    const handleNewWhatsAppMessage = async (message: any) => {
      console.log('📨 Nova mensagem WhatsApp recebida:', message);
      
      try {
        // Extrair nome real do WhatsApp
        const customerName = extractWhatsAppName(message) || `Contato ${message.from?.replace(/\D/g, '') || ''}`;
        const customerPhone = message.from?.replace(/\D/g, '') || '';
        
        console.log('🔍 Nome extraído:', customerName);
        
        // Encontrar ou criar ticket para esta conversa
        const ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          message.from || message.chatId,
          clientId, // instance_id
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

        // Recarregar tickets para mostrar atualização
        await loadTickets();
        
      } catch (error) {
        console.error('Erro ao processar nova mensagem:', error);
      }
    };

    // Conectar ao WebSocket do WhatsApp para mensagens em tempo real
    const socket = whatsappService.connectSocket();
    whatsappService.joinClientRoom(clientId);
    whatsappService.onClientMessage(clientId, handleNewWhatsAppMessage);

    // Listener para atualizações de tickets no Supabase
    const channel = supabase
      .channel('ticket-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        async (payload) => {
          console.log('🔄 Ticket atualizado:', payload);
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
          console.log('💬 Nova mensagem de ticket:', payload);
          await loadTickets();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
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
