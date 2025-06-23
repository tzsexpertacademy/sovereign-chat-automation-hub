
import { useEffect, useCallback } from 'react';
import { useAssistantMessageHandler } from './useAssistantMessageHandler';
import { whatsappService } from '@/services/whatsappMultiClient';

interface MessageData {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  type: string;
  fromMe: boolean;
}

export const useMessageListener = (
  clientId: string,
  ticketId: string,
  assistantId?: string
) => {
  const { handleIncomingMessage, isProcessing } = useAssistantMessageHandler(clientId);

  const onNewMessage = useCallback((message: MessageData) => {
    console.log('📲 Nova mensagem recebida:', {
      id: message.id,
      from: message.from,
      fromMe: message.fromMe,
      type: message.type
    });

    if (ticketId && assistantId) {
      handleIncomingMessage(message, ticketId, assistantId);
    }
  }, [handleIncomingMessage, ticketId, assistantId]);

  useEffect(() => {
    if (!clientId) return;

    console.log('🔄 Configurando listener de mensagens para cliente:', clientId);
    
    // Configurar listener para novas mensagens
    whatsappService.onClientMessage(clientId, onNewMessage);

    return () => {
      console.log('🔌 Removendo listener de mensagens');
      whatsappService.removeListener(`message_${clientId}`, onNewMessage);
    };
  }, [clientId, onNewMessage]);

  return {
    isProcessing
  };
};
