import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MessageStatus {
  messageId: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  error?: string;
}

interface UseMessageStatusProps {
  ticketId: string;
  onStatusChange?: (messageId: string, status: MessageStatus['status']) => void;
}

export const useMessageStatus = ({ ticketId, onStatusChange }: UseMessageStatusProps) => {
  const [messageStatuses, setMessageStatuses] = useState<Map<string, MessageStatus>>(new Map());
  const channelRef = useRef<any>(null);

  // Atualizar status de uma mensagem específica
  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus['status'], error?: string) => {
    const newStatus: MessageStatus = {
      messageId,
      status,
      timestamp: new Date(),
      error
    };

    setMessageStatuses(prev => new Map(prev.set(messageId, newStatus)));
    
    // Atualizar no banco de dados
    if (status !== 'sending') {
      supabase
        .from('ticket_messages')
        .update({ processing_status: status })
        .eq('message_id', messageId)
        .then(({ error }) => {
          if (error) {
            console.error('❌ [MESSAGE-STATUS] Erro ao atualizar status no DB:', error);
          } else {
            console.log(`✅ [MESSAGE-STATUS] Status atualizado no DB: ${messageId} -> ${status}`);
          }
        });
    }

    onStatusChange?.(messageId, status);
  }, [onStatusChange]);

  // Obter status de uma mensagem
  const getMessageStatus = useCallback((messageId: string): MessageStatus['status'] => {
    return messageStatuses.get(messageId)?.status || 'sent';
  }, [messageStatuses]);

  // Marcar mensagem como enviando
  const markAsSending = useCallback((messageId: string) => {
    updateMessageStatus(messageId, 'sending');
  }, [updateMessageStatus]);

  // Marcar mensagem como enviada
  const markAsSent = useCallback((messageId: string) => {
    updateMessageStatus(messageId, 'sent');
  }, [updateMessageStatus]);

  // Marcar mensagem como entregue
  const markAsDelivered = useCallback((messageId: string) => {
    updateMessageStatus(messageId, 'delivered');
  }, [updateMessageStatus]);

  // Marcar mensagem como lida
  const markAsRead = useCallback((messageId: string) => {
    updateMessageStatus(messageId, 'read');
  }, [updateMessageStatus]);

  // Marcar mensagem como falha
  const markAsFailed = useCallback((messageId: string, error?: string) => {
    updateMessageStatus(messageId, 'failed', error);
  }, [updateMessageStatus]);

  // Listener para atualizações via webhook
  useEffect(() => {
    if (!ticketId) return;

    console.log('🔔 [MESSAGE-STATUS] Configurando listener para status de mensagens');

    // Limpar canal anterior se existir
    if (channelRef.current) {
      console.log('🔌 [MESSAGE-STATUS] Removendo canal anterior');
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`message-status-${ticketId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          if (updatedMessage?.message_id && updatedMessage?.processing_status) {
            console.log('🔔 [MESSAGE-STATUS] Status atualizado via webhook:', {
              messageId: updatedMessage.message_id,
              status: updatedMessage.processing_status
            });

            updateMessageStatus(
              updatedMessage.message_id,
              updatedMessage.processing_status,
              updatedMessage.error_message
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('🔌 [MESSAGE-STATUS] Removendo listener');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [ticketId, updateMessageStatus]);

  return {
    messageStatuses: Array.from(messageStatuses.values()),
    getMessageStatus,
    markAsSending,
    markAsSent,
    markAsDelivered,
    markAsRead,
    markAsFailed,
    updateMessageStatus
  };
};