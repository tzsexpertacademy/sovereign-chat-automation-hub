
import { useState, useCallback, useEffect } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusState {
  [messageId: string]: MessageStatus;
}

export const useMessageStatus = (clientId?: string, chatId?: string) => {
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

  const markMessageAsRead = useCallback(async (messageId: string) => {
    console.log(`👁️ Marcando mensagem como lida: ${messageId}`);
    updateMessageStatus(messageId, 'read');
    
    // Send read receipt to WhatsApp
    if (clientId && chatId) {
      try {
        await whatsappService.markMessageAsRead(clientId, chatId, messageId);
        console.log(`✅ Read receipt sent to WhatsApp for message: ${messageId}`);
      } catch (error) {
        console.error('Failed to send read receipt to WhatsApp:', error);
      }
    }
  }, [updateMessageStatus, clientId, chatId]);

  const markMessageAsDelivered = useCallback((messageId: string) => {
    console.log(`📦 Marcando mensagem como entregue: ${messageId}`);
    updateMessageStatus(messageId, 'delivered');
  }, [updateMessageStatus]);

  const markMessageAsFailed = useCallback((messageId: string) => {
    console.log(`❌ Marcando mensagem como falha: ${messageId}`);
    updateMessageStatus(messageId, 'failed');
  }, [updateMessageStatus]);

  // Listen for read receipts from WhatsApp
  useEffect(() => {
    if (!clientId) return;

    const handleReadReceipt = (data: { chatId: string, messageId: string, readBy: string, timestamp: string }) => {
      console.log('📬 Read receipt received from WhatsApp:', data);
      if (data.chatId === chatId) {
        updateMessageStatus(data.messageId, 'read');
      }
    };

    whatsappService.onReadReceiptEvent(clientId, handleReadReceipt);

    return () => {
      whatsappService.removeReadReceiptListener(clientId);
    };
  }, [clientId, chatId, updateMessageStatus]);

  return {
    messageStatuses,
    updateMessageStatus,
    getMessageStatus,
    markMessageAsRead,
    markMessageAsDelivered,
    markMessageAsFailed
  };
};
