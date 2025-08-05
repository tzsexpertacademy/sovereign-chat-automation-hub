import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SimpleTicketSyncConfig {
  clientId: string;
  onUpdate: () => void;
  onTicketReopen?: (ticketId: string, newQueueId: string) => void;
}

export const useSimpleTicketSync = ({ 
  clientId, 
  onUpdate,
  onTicketReopen
}: SimpleTicketSyncConfig) => {
  const channelRef = useRef<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const handleChange = useCallback((payload: any) => {
    const { eventType, new: newTicket, old: oldTicket } = payload;
    
    console.log('🚀 [SIMPLE-SYNC] Mudança detectada:', {
      evento: eventType,
      ticketId: (newTicket as any)?.id || (oldTicket as any)?.id,
      status: (newTicket as any)?.status
    });

    // FORÇA UPDATE IMEDIATO
    setLastUpdate(new Date());
    onUpdate();

    // DETECTAR REABERTURA 
    if (eventType === 'UPDATE' && oldTicket && newTicket) {
      const oldT = oldTicket as any;
      const newT = newTicket as any;
      
      if (['closed', 'resolved'].includes(oldT.status) && newT.status === 'open') {
        console.log('🔓 [SIMPLE-SYNC] REABERTURA DETECTADA:', newT.id);
        
        if (onTicketReopen) {
          onTicketReopen(newT.id, newT.assigned_queue_id);
        }
        
        // FORÇA UPDATE ADICIONAL APÓS 500ms PARA GARANTIR
        setTimeout(() => {
          console.log('🔄 [SIMPLE-SYNC] Update adicional pós-reabertura');
          onUpdate();
        }, 500);
      }
    }
  }, [onUpdate, onTicketReopen]);

  useEffect(() => {
    if (!clientId) return;

    console.log('🔗 [SIMPLE-SYNC] Iniciando para:', clientId);

    const channel = supabase
      .channel(`simple-sync-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        handleChange
      )
      .subscribe((status) => {
        console.log('🔗 [SIMPLE-SYNC] Status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('🧹 [SIMPLE-SYNC] Cleanup');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clientId, handleChange]);

  return {
    isActive: channelRef.current !== null,
    lastUpdate
  };
};