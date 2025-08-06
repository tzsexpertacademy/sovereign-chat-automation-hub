import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Carregar tickets inicial
  const loadTickets = async () => {
    if (!clientId || !mountedRef.current) return;
    
    try {
      setIsLoading(true);
      console.log('🔄 [REALTIME] Carregando tickets para:', clientId);
      
      const ticketsData = await ticketsService.getTicketsByClient(clientId);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
        console.log('✅ [REALTIME] Tickets carregados:', ticketsData.length);
      }
    } catch (error) {
      console.error('❌ [REALTIME] Erro ao carregar tickets:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Setup realtime
  useEffect(() => {
    if (!clientId) return;

    // Carregamento inicial
    loadTickets();

    // Setup canal realtime
    console.log('🔌 [REALTIME] Configurando canal para cliente:', clientId);
    
    const channel = supabase
      .channel(`tickets-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          console.log('📨 [REALTIME] Mudança detectada, recarregando...');
          loadTickets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages'
        },
        () => {
          console.log('💬 [REALTIME] Nova mensagem, recarregando...');
          loadTickets();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 [REALTIME] Desconectando canal');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clientId]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    tickets,
    isLoading,
    reloadTickets: loadTickets
  };
};