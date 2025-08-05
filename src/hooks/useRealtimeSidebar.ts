import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeSidebarConfig {
  clientId: string;
  onTicketUpdate: (ticket: any) => void;
  onNewMessage: (ticketId: string, preview: string) => void;
  onStatusChange?: (ticketId: string, oldStatus: string, newStatus: string) => void;
}

export const useRealtimeSidebar = ({ 
  clientId, 
  onTicketUpdate, 
  onNewMessage,
  onStatusChange 
}: RealtimeSidebarConfig) => {
  const channelRef = useRef<any>(null);

  // 🔄 ATUALIZAR TICKET automaticamente quando nova mensagem chega
  const updateTicketMetadata = useCallback(async (ticketId: string, messageContent: string, timestamp: string) => {
    try {
      const { error } = await supabase
        .from('conversation_tickets')
        .update({
          last_message_preview: messageContent.substring(0, 100),
          last_message_at: timestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        console.error('❌ [SIDEBAR] Erro ao atualizar ticket:', error);
      } else {
        console.log('✅ [SIDEBAR] Ticket atualizado:', { ticketId, preview: messageContent.substring(0, 30) });
      }
    } catch (error) {
      console.error('❌ [SIDEBAR] Erro na atualização do ticket:', error);
    }
  }, []);

  useEffect(() => {
    if (!clientId) return;

    console.log('📡 [SIDEBAR] Iniciando listener para sidebar em tempo real');

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
            console.log('🎯 [SIDEBAR] Ticket atualizado via realtime:', updatedTicket.id);
            
            // Detectar mudança de status
            if (payload.old && onStatusChange) {
              const oldTicket = payload.old as any;
              if (oldTicket.status !== updatedTicket.status) {
                console.log('🔄 [SIDEBAR] Status alterado:', {
                  ticketId: updatedTicket.id,
                  from: oldTicket.status,
                  to: updatedTicket.status
                });
                onStatusChange(updatedTicket.id, oldTicket.status, updatedTicket.status);
              }
            }
            
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
        async (payload) => {
          if (payload.new) {
            const newMessage = payload.new as any;
            console.log('📨 [SIDEBAR] Nova mensagem detectada:', {
              ticketId: newMessage.ticket_id,
              messageId: newMessage.message_id,
              content: newMessage.content?.substring(0, 30)
            });
            
            // Verificar se é um ticket do cliente
            const { data: ticket } = await supabase
              .from('conversation_tickets')
              .select('client_id')
              .eq('id', newMessage.ticket_id)
              .single();

            if (ticket?.client_id === clientId && newMessage.content && newMessage.ticket_id) {
              // Atualizar metadados do ticket
              await updateTicketMetadata(
                newMessage.ticket_id,
                newMessage.content,
                newMessage.timestamp || new Date().toISOString()
              );
              
              // Notificar callback
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
        console.log('🧹 [SIDEBAR] Removendo listener');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clientId, onTicketUpdate, onNewMessage, onStatusChange, updateTicketMetadata]);

  return {
    isActive: channelRef.current !== null
  };
};