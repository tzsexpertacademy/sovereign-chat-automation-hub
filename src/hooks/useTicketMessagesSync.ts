import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type TicketMessage } from '@/services/ticketsService';

interface TicketMessagesSyncConfig {
  ticketId: string;
  clientId: string;
}

/**
 * Hook dedicado APENAS à sincronização de mensagens via Supabase
 * Independente do WebSocket - sempre ativo
 */
export const useTicketMessagesSync = ({ ticketId, clientId }: TicketMessagesSyncConfig) => {
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // Callback para quando nova mensagem chegar
  const onNewMessage = useCallback((callback: (message: TicketMessage) => void) => {
    processNewMessageCallback.current = callback;
  }, []);

  const processNewMessageCallback = useRef<((message: TicketMessage) => void) | null>(null);

  // Setup do listener Supabase
  const setupSyncListener = useCallback(() => {
    if (!ticketId || channelRef.current) return;

    console.log('🔄 [SYNC] *** ATIVANDO SYNC DEDICADO ***:', ticketId);

    const channel = supabase
      .channel(`sync-ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('📨 [SYNC] *** NOVA MENSAGEM DETECTADA ***:', payload);
          
          if (payload.new) {
            const newMessage = payload.new as TicketMessage;
            
            // Verificar se já foi processada
            if (!processedMessagesRef.current.has(newMessage.message_id)) {
              processedMessagesRef.current.add(newMessage.message_id);
              setNewMessagesCount(prev => prev + 1);
              setLastSyncTime(new Date());
              
              console.log('✅ [SYNC] *** MENSAGEM PROCESSADA ***:', {
                messageId: newMessage.message_id,
                content: newMessage.content?.substring(0, 50),
                fromMe: newMessage.from_me
              });
              
              // Notificar callback se existe
              if (processNewMessageCallback.current) {
                processNewMessageCallback.current(newMessage);
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [SYNC] Status:', status);
      });

    channelRef.current = channel;
  }, [ticketId]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    processedMessagesRef.current.clear();
  }, []);

  // Reset contadores
  const resetCounters = useCallback(() => {
    setNewMessagesCount(0);
    processedMessagesRef.current.clear();
  }, []);

  // Effect principal
  useEffect(() => {
    if (!ticketId) {
      cleanup();
      return;
    }

    setupSyncListener();

    return cleanup;
  }, [ticketId, setupSyncListener, cleanup]);

  return {
    newMessagesCount,
    lastSyncTime,
    isActive: !!channelRef.current,
    onNewMessage,
    resetCounters,
    cleanup
  };
};