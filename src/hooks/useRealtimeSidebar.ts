import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeSidebarConfig {
  clientId: string;
  onTicketUpdate: (ticket: any) => void;
  onNewMessage: (ticketId: string, preview: string) => void;
}

export const useRealtimeSidebar = ({ 
  clientId, 
  onTicketUpdate, 
  onNewMessage 
}: RealtimeSidebarConfig) => {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!clientId) return;

    // 📡 LISTENER DEDICADO PARA SIDEBAR
    const channel = supabase
      .channel(`sidebar-realtime-${clientId}`, {
        config: {
          presence: { key: 'sidebar_updates' }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tickets',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedTicket = payload.new as any;
            onTicketUpdate(updatedTicket);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages'
        },
        (payload) => {
          if (payload.new) {
            const newMessage = payload.new as any;
            // Só atualizar se a mensagem é para um ticket deste cliente
            if (newMessage.content && newMessage.ticket_id) {
              onNewMessage(
                newMessage.ticket_id, 
                newMessage.content.substring(0, 50)
              );
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clientId, onTicketUpdate, onNewMessage]);

  return {
    isActive: channelRef.current !== null
  };
};