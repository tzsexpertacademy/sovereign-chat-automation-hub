
import { useState, useCallback } from 'react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusState {
  [messageId: string]: MessageStatus;
}

export const useMessageStatus = () => {
  const [messageStatuses, setMessageStatuses] = useState<MessageStatusState>({});

  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    console.log(`📱 Status da mensagem ${messageId}: ${status}`);
    setMessageStatuses(prev => ({
      ...prev,
      [messageId]: status
    }));
  }, []);

  const getMessageStatus = useCallback((messageId: string): MessageStatus => {
    const status = messageStatuses[messageId] || 'sent';
    return status;
  }, [messageStatuses]);

  const markMessageAsRead = useCallback((messageId: string) => {
    console.log(`👁️ Marcando mensagem como lida: ${messageId}`);
    updateMessageStatus(messageId, 'read');
  }, [updateMessageStatus]);

  const markMessageAsDelivered = useCallback((messageId: string) => {
    console.log(`📦 Marcando mensagem como entregue: ${messageId}`);
    updateMessageStatus(messageId, 'delivered');
  }, [updateMessageStatus]);

  const markMessageAsFailed = useCallback((messageId: string) => {
    console.log(`❌ Marcando mensagem como falha: ${messageId}`);
    updateMessageStatus(messageId, 'failed');
  }, [updateMessageStatus]);

  return {
    messageStatuses,
    updateMessageStatus,
    getMessageStatus,
    markMessageAsRead,
    markMessageAsDelivered,
    markMessageAsFailed
  };
};
