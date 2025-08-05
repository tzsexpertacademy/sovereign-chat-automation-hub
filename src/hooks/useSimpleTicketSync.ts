import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SimpleTicketSyncConfig {
  clientId: string;
  onUpdate: () => void;
  onTicketReopen?: (ticketId: string, newQueueId: string) => void;
  onAutoSwitchTab?: (targetTab: 'open' | 'closed') => void;
}

export const useSimpleTicketSync = ({ 
  clientId, 
  onUpdate,
  onTicketReopen,
  onAutoSwitchTab
}: SimpleTicketSyncConfig) => {
  const channelRef = useRef<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = useCallback((payload: any) => {
    const { eventType, new: newTicket, old: oldTicket } = payload;
    
    console.log('🚀 [SIMPLE-SYNC] Mudança detectada:', {
      evento: eventType,
      ticketId: (newTicket as any)?.id || (oldTicket as any)?.id,
      oldStatus: (oldTicket as any)?.status,
      newStatus: (newTicket as any)?.status,
      timestamp: new Date().toISOString()
    });

    // FORÇA UPDATE IMEDIATO - SEM DEBOUNCE
    setLastUpdate(new Date());
    
    // TRIPLE UPDATE para garantir sync
    onUpdate();
    setTimeout(() => onUpdate(), 100);
    setTimeout(() => onUpdate(), 500);

    // DETECTAR REABERTURA E AUTO-SWITCH
    if (eventType === 'UPDATE' && oldTicket && newTicket) {
      const oldT = oldTicket as any;
      const newT = newTicket as any;
      
      if (['closed', 'resolved'].includes(oldT.status) && newT.status === 'open') {
        console.log('🔓 [SIMPLE-SYNC] REABERTURA DETECTADA:', {
          ticketId: newT.id,
          oldStatus: oldT.status,
          newStatus: newT.status,
          queueId: newT.assigned_queue_id
        });
        
        // AUTO-SWITCH para aba Abertos
        if (onAutoSwitchTab) {
          console.log('🔄 [SIMPLE-SYNC] AUTO-SWITCHING para aba Abertos');
          onAutoSwitchTab('open');
        }
        
        if (onTicketReopen) {
          onTicketReopen(newT.id, newT.assigned_queue_id);
        }
        
        // FORÇA MÚLTIPLOS UPDATES PARA GARANTIR VISIBILIDADE
        setTimeout(() => {
          console.log('🔄 [SIMPLE-SYNC] Update 1 pós-reabertura');
          onUpdate();
        }, 200);
        
        setTimeout(() => {
          console.log('🔄 [SIMPLE-SYNC] Update 2 pós-reabertura');
          onUpdate();
        }, 1000);
      }
    }
  }, [onUpdate, onTicketReopen, onAutoSwitchTab]);

  useEffect(() => {
    if (!clientId) return;

    console.log('🔗 [SIMPLE-SYNC] Iniciando para:', clientId);

    const channel = supabase
      .channel(`simple-sync-${clientId}-${Date.now()}`) // Canal único
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
        console.log('🔗 [SIMPLE-SYNC] Status:', status, 'Time:', new Date().toISOString());
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [SIMPLE-SYNC] CONECTADO e OUVINDO mudanças!');
        }
      });

    channelRef.current = channel;

    // POLLING DE BACKUP a cada 2 segundos
    console.log('⏰ [SIMPLE-SYNC] Iniciando polling de backup');
    pollingIntervalRef.current = setInterval(() => {
      console.log('🔄 [POLLING] Backup update a cada 2s');
      onUpdate();
    }, 2000);

    return () => {
      if (channelRef.current) {
        console.log('🧹 [SIMPLE-SYNC] Cleanup channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (pollingIntervalRef.current) {
        console.log('🧹 [SIMPLE-SYNC] Cleanup polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [clientId, handleChange, onUpdate]);

  return {
    isActive: channelRef.current !== null,
    lastUpdate
  };
};