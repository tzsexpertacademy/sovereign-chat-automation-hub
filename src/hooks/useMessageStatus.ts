
import { useState, useCallback } from 'react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusState {
  [messageId: string]: MessageStatus;
}

export const useMessageStatus = () => {
  const [messageStatuses, setMessageStatuses] = useState<MessageStatusState>({});

  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setMessageStatuses(prev => ({
      ...prev,
      [messageId]: status
    }));
  }, []);

  const getMessageStatus = useCallback((messageId: string): MessageStatus => {
    return messageStatuses[messageId] || 'sent';
  }, [messageStatuses]);

  const markMessageAsRead = useCallback((messageId: string) => {
    updateMessageStatus(messageId, 'read');
  }, [updateMessageStatus]);

  const markMessageAsDelivered = useCallback((messageId: string) => {
    updateMessageStatus(messageId, 'delivered');
  }, [updateMessageStatus]);

  return {
    messageStatuses,
    updateMessageStatus,
    getMessageStatus,
    markMessageAsRead,
    markMessageAsDelivered
  };
};
