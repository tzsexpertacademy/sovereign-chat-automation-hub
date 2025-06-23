
import { useState, useCallback } from 'react';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export const useMessageStatus = () => {
  const [messageStatuses, setMessageStatuses] = useState<Map<string, MessageStatus>>(new Map());

  const trackMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    console.log('📊 Rastreando status da mensagem:', messageId, status);
    setMessageStatuses(prev => new Map(prev.set(messageId, status)));
  }, []);

  const getMessageStatus = useCallback((messageId: string): MessageStatus => {
    return messageStatuses.get(messageId) || 'sent';
  }, [messageStatuses]);

  return {
    trackMessageStatus,
    getMessageStatus,
    messageStatuses
  };
};
