
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';

export const useRealtimeTickets = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Função simples para carregar tickets
  const loadTickets = async () => {
    if (!clientId || !mountedRef.current) return;
    
    try {
      setIsLoading(true);
      console.log('🔄 [SIMPLE] Carregando tickets para:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
        console.log('✅ [SIMPLE] Tickets carregados:', ticketsData.length);
      }
    } catch (error) {
      console.error('❌ [SIMPLE] Erro ao carregar tickets:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Configurar listener simples do Supabase
  useEffect(() => {
    if (!clientId) return;

    console.log('🔌 [SIMPLE] Configurando listener para:', clientId);
    mountedRef.current = true;

    // Carregar tickets imediatamente
    loadTickets();

    // Remover canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Canal simples apenas para tickets
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
        (payload) => {
          console.log('📊 [SIMPLE] Mudança em ticket:', payload.eventType);
          // Recarregar todos os tickets quando houver mudança
          loadTickets();
        }
      )
      .subscribe((status) => {
        console.log('📡 [SIMPLE] Status do canal:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('🔌 [SIMPLE] Limpando recursos');
      mountedRef.current = false;
      
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
