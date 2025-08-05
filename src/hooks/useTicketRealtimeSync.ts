import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TicketRealtimeSyncConfig {
  clientId: string;
  onTicketUpdate: () => void;
  onTicketReopen?: (ticketId: string, newQueueId: string) => void;
  onQueueTransfer?: (ticketId: string, fromQueueId: string, toQueueId: string) => void;
}

export const useTicketRealtimeSync = ({ 
  clientId, 
  onTicketUpdate,
  onTicketReopen,
  onQueueTransfer
}: TicketRealtimeSyncConfig) => {
  const channelRef = useRef<any>(null);

  const handleTicketChange = useCallback((payload: any) => {
    const { eventType, new: newTicket, old: oldTicket } = payload;
    
    console.log('🎯 [SYNC] Mudança detectada em ticket:', {
      evento: eventType,
      ticketId: (newTicket as any)?.id || (oldTicket as any)?.id
    });

    // REABERTURA AUTOMÁTICA
    if (eventType === 'UPDATE' && oldTicket && newTicket) {
      const oldT = oldTicket as any;
      const newT = newTicket as any;
      
      const statusMudou = oldT.status !== newT.status;
      const filaMudou = oldT.assigned_queue_id !== newT.assigned_queue_id;
      
      // Detectar reabertura
      if (statusMudou && ['closed', 'resolved'].includes(oldT.status) && newT.status === 'open') {
        console.log('🔓 [SYNC] REABERTURA detectada:', {
          ticketId: newT.id,
          novaFila: newT.assigned_queue_id
        });
        
        if (onTicketReopen) {
          onTicketReopen(newT.id, newT.assigned_queue_id);
        }
      }
      
      // Detectar transferência de fila
      if (filaMudou && oldT.assigned_queue_id && newT.assigned_queue_id) {
        console.log('🔄 [SYNC] TRANSFERÊNCIA detectada:', {
          ticketId: newT.id,
          de: oldT.assigned_queue_id,
          para: newT.assigned_queue_id
        });
        
        if (onQueueTransfer) {
          onQueueTransfer(newT.id, oldT.assigned_queue_id, newT.assigned_queue_id);
        }
      }
    }
    
    // Sempre disparar atualização geral
    onTicketUpdate();
  }, [onTicketUpdate, onTicketReopen, onQueueTransfer]);

  useEffect(() => {
    if (!clientId) return;

    console.log('🔗 [SYNC] Iniciando sincronização de tickets para:', clientId);

    const channel = supabase
      .channel(`tickets-sync-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        handleTicketChange
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('🧹 [SYNC] Removendo sincronização');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clientId, handleTicketChange]);

  return {
    isActive: channelRef.current !== null
  };
};