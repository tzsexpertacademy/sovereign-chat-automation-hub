
import { useState, useCallback } from 'react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusState {
  [messageId: string]: MessageStatus;
}

interface MessageReadInfo {
  messageId: string;
  isAiResponse: boolean;
  readAt: string;
}

export const useMessageStatus = () => {
  const [messageStatuses, setMessageStatuses] = useState<MessageStatusState>({});
  const [readMessages, setReadMessages] = useState<Map<string, MessageReadInfo>>(new Map());

  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus, isAiResponse = false) => {
    console.log(`📱 Status da mensagem ${messageId}: ${status}${isAiResponse ? ' (IA)' : ''}`);
    
    setMessageStatuses(prev => ({
      ...prev,
      [messageId]: status
    }));

    // Se foi marcada como lida, registrar informações adicionais
    if (status === 'read') {
      setReadMessages(prev => new Map(prev).set(messageId, {
        messageId,
        isAiResponse,
        readAt: new Date().toISOString()
      }));
      
      console.log(`👁️ CONFIRMAÇÃO DE LEITURA: Mensagem ${messageId} ${isAiResponse ? 'lida pela IA ✓✓' : 'lida ✓✓'}`);
    }
  }, []);

  const getMessageStatus = useCallback((messageId: string): MessageStatus => {
    return messageStatuses[messageId] || 'sent';
  }, [messageStatuses]);

  const getReadInfo = useCallback((messageId: string): MessageReadInfo | null => {
    return readMessages.get(messageId) || null;
  }, [readMessages]);

  const markMessageAsRead = useCallback((messageId: string, isAiResponse = false) => {
    console.log(`👁️ Marcando mensagem como lida: ${messageId}${isAiResponse ? ' (por IA)' : ''}`);
    updateMessageStatus(messageId, 'read', isAiResponse);
  }, [updateMessageStatus]);

  const markMessageAsDelivered = useCallback((messageId: string) => {
    console.log(`📦 Marcando mensagem como entregue: ${messageId}`);
    updateMessageStatus(messageId, 'delivered');
  }, [updateMessageStatus]);

  const markMessageAsFailed = useCallback((messageId: string) => {
    console.log(`❌ Marcando mensagem como falha: ${messageId}`);
    updateMessageStatus(messageId, 'failed');
  }, [updateMessageStatus]);

  const markMessageAsSending = useCallback((messageId: string) => {
    console.log(`📤 Marcando mensagem como enviando: ${messageId}`);
    updateMessageStatus(messageId, 'sending');
  }, [updateMessageStatus]);

  const markMessageAsSent = useCallback((messageId: string) => {
    console.log(`✅ Marcando mensagem como enviada: ${messageId}`);
    updateMessageStatus(messageId, 'sent');
  }, [updateMessageStatus]);

  // Simular progressão automática de status
  const simulateMessageProgression = useCallback((messageId: string, isAiResponse = false) => {
    markMessageAsSending(messageId);
    
    // Sent após 500ms
    setTimeout(() => {
      markMessageAsSent(messageId);
    }, 500);
    
    // Delivered após 1-2s
    setTimeout(() => {
      markMessageAsDelivered(messageId);
    }, 1000 + Math.random() * 1000);
    
    // Read após 2-4s (mais rápido para IA)
    setTimeout(() => {
      markMessageAsRead(messageId, isAiResponse);
    }, (isAiResponse ? 1500 : 2000) + Math.random() * 2000);
  }, [markMessageAsSending, markMessageAsSent, markMessageAsDelivered, markMessageAsRead]);

  return {
    messageStatuses,
    readMessages,
    updateMessageStatus,
    getMessageStatus,
    getReadInfo,
    markMessageAsRead,
    markMessageAsDelivered,
    markMessageAsFailed,
    markMessageAsSending,
    markMessageAsSent,
    simulateMessageProgression
  };
};
