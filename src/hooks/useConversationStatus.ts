
import { useState, useCallback, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export interface ConversationStatus {
  chatId: string;
  isClientResponding: boolean;
  lastClientActivity: number;
  shouldPauseAssistant: boolean;
}

export const useConversationStatus = (clientId: string) => {
  const [conversationStatuses, setConversationStatuses] = useState<Map<string, ConversationStatus>>(new Map());
  const activityTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Marcar que o cliente está respondendo
  const markClientResponding = useCallback((chatId: string) => {
    console.log('📱 Cliente marcou conversa para responder:', chatId);
    
    setConversationStatuses(prev => {
      const newMap = new Map(prev);
      newMap.set(chatId, {
        chatId,
        isClientResponding: true,
        lastClientActivity: Date.now(),
        shouldPauseAssistant: true
      });
      return newMap;
    });

    // Limpar timeout anterior se existir
    const existingTimeout = activityTimeouts.current.get(chatId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Definir timeout para considerar que cliente parou de responder (2 minutos sem atividade)
    const timeout = setTimeout(() => {
      console.log('⏰ Cliente parou de responder (timeout):', chatId);
      setConversationStatuses(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(chatId);
        if (status) {
          newMap.set(chatId, {
            ...status,
            isClientResponding: false,
            shouldPauseAssistant: false
          });
        }
        return newMap;
      });
      activityTimeouts.current.delete(chatId);
    }, 2 * 60 * 1000); // 2 minutos

    activityTimeouts.current.set(chatId, timeout);
  }, []);

  // Marcar que o cliente parou de responder
  const markClientStoppedResponding = useCallback((chatId: string) => {
    console.log('✋ Cliente parou de responder:', chatId);
    
    setConversationStatuses(prev => {
      const newMap = new Map(prev);
      const status = newMap.get(chatId);
      if (status) {
        newMap.set(chatId, {
          ...status,
          isClientResponding: false,
          shouldPauseAssistant: false
        });
      }
      return newMap;
    });

    // Limpar timeout
    const timeout = activityTimeouts.current.get(chatId);
    if (timeout) {
      clearTimeout(timeout);
      activityTimeouts.current.delete(chatId);
    }
  }, []);

  // Verificar se assistente deve pausar para um chat específico
  const shouldPauseAssistant = useCallback((chatId: string): boolean => {
    const status = conversationStatuses.get(chatId);
    return status?.shouldPauseAssistant || false;
  }, [conversationStatuses]);

  // Obter status de uma conversa
  const getConversationStatus = useCallback((chatId: string): ConversationStatus | null => {
    return conversationStatuses.get(chatId) || null;
  }, [conversationStatuses]);

  return {
    conversationStatuses,
    markClientResponding,
    markClientStoppedResponding,
    shouldPauseAssistant,
    getConversationStatus
  };
};
